import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { loadDashboardData } from './services/sheets'
import {
  buildTrend,
  getAchievements,
  getTierLabel,
  scoreTeammates,
} from './utils/scoring'
import {
  compactCurrency,
  formatAjs,
  formatCurrency,
  formatNumber,
  formatPercent,
  parseNumber,
  safeDivide,
} from './utils/formatters'

const PERIODS = ['MTD', 'QTD', 'YTD']
const ROUTE_STANDARDS = {
  totalRevenue: 4000,
  ajs: 800,
  resiAjs: 900,
  truckPlusPct: 50,
}

export default function App() {
  const [activeTab, setActiveTab] = useState('leaderboard')
  const [period, setPeriod] = useState('MTD')
  const [query, setQuery] = useState('')
  const [dashboardData, setDashboardData] = useState({
    teammates: [],
    routes: [],
    source: 'sample',
    updatedAt: null,
    warning: '',
  })
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState('')
  const [selectedTeammate, setSelectedTeammate] = useState(null)
  const [isDark, setIsDark] = useState(true)

  const refreshData = useCallback(async () => {
    setLoading(true)
    const nextData = await loadDashboardData()
    setDashboardData(nextData)
    setLoading(false)
  }, [])

  useEffect(() => {
    refreshData()
    const intervalId = window.setInterval(refreshData, 60000)
    return () => window.clearInterval(intervalId)
  }, [refreshData])

  const scoredTeammates = useMemo(
    () => scoreTeammates(dashboardData.teammates),
    [dashboardData.teammates],
  )

  const filteredTeammates = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    if (!normalizedQuery) {
      return scoredTeammates
    }

    return scoredTeammates.filter((teammate) =>
      `${teammate.name} ${teammate.position}`.toLowerCase().includes(normalizedQuery),
    )
  }, [query, scoredTeammates])

  const routeTotals = useMemo(() => buildRouteTotals(dashboardData.routes), [dashboardData.routes])
  const topHauler = scoredTeammates[0]

  return (
    <main className={`dashboard-shell ${isDark ? 'dark-dashboard' : 'light-dashboard'}`}>
      <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-6 px-4 py-5 sm:px-6 lg:px-8">
        <Header
          activeTab={activeTab}
          isDark={isDark}
          loading={loading}
          period={period}
          routeTotals={routeTotals}
          setActiveTab={setActiveTab}
          setIsDark={setIsDark}
          setPeriod={setPeriod}
          teammatesCount={scoredTeammates.length}
          topHauler={topHauler}
          updatedAt={dashboardData.updatedAt}
        />

        {dashboardData.warning ? (
          <div className="glass-panel rounded-2xl border-l-4 border-l-[var(--orange)] px-4 py-3 text-sm text-[var(--muted-strong)]">
            {dashboardData.warning}
          </div>
        ) : null}

        {activeTab === 'leaderboard' ? (
          <Leaderboard
            expandedId={expandedId}
            period={period}
            query={query}
            setExpandedId={setExpandedId}
            setQuery={setQuery}
            setSelectedTeammate={setSelectedTeammate}
            teammates={filteredTeammates}
            totalTeammates={scoredTeammates.length}
          />
        ) : (
          <LiveRoutes
            loading={loading}
            refreshData={refreshData}
            routes={dashboardData.routes}
            routeTotals={routeTotals}
            updatedAt={dashboardData.updatedAt}
          />
        )}
      </div>

      {selectedTeammate ? (
        <ProfileModal teammate={selectedTeammate} onClose={() => setSelectedTeammate(null)} />
      ) : null}
    </main>
  )
}

function Header({
  activeTab,
  isDark,
  loading,
  period,
  routeTotals,
  setActiveTab,
  setIsDark,
  setPeriod,
  teammatesCount,
  topHauler,
  updatedAt,
}) {
  return (
    <section className="scoreboard-card overflow-hidden rounded-[2rem]">
      <div className="relative border-b border-[var(--border)] px-5 py-5 sm:px-7 lg:px-8">
        <div className="absolute inset-y-0 right-0 hidden w-1/2 diagonal-stripes opacity-40 md:block" />
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--panel-soft)] px-3 py-1 text-xs font-black uppercase tracking-[0.32em] text-[var(--orange)]">
              Atlanta Franchise - 110+ Teammates
            </div>
            <h1 className="score-font text-5xl font-black uppercase leading-none tracking-tight sm:text-6xl lg:text-7xl">
              Haulers <span className="text-[var(--orange)]">&</span> Ballers
            </h1>
            <p className="mt-3 max-w-2xl text-sm font-medium text-[var(--muted)] sm:text-base">
              Competitive production scoreboard and live daily route tracker powered by Google
              Sheets.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:min-w-[34rem]">
            <ScoreTile label="Top Hauler" value={topHauler?.name || 'Loading'} detail={topHauler?.score ? `${topHauler.score} score` : 'Rank #1'} />
            <ScoreTile label="Roster" value={teammatesCount || '110+'} detail="teammates tracked" />
            <ScoreTile label="Today" value={compactCurrency(routeTotals.totalRevenue)} detail={`${routeTotals.routeCount} routes`} />
            <ScoreTile label="Avg AJS" value={formatAjs(routeTotals.avgAjs)} detail={loading ? 'refreshing...' : formatUpdated(updatedAt)} />
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-4 px-5 py-4 sm:px-7 lg:flex-row lg:items-center lg:justify-between lg:px-8">
        <div className="inline-flex rounded-2xl border border-[var(--border)] bg-[var(--panel-soft)] p-1">
          <TabButton
            active={activeTab === 'leaderboard'}
            label="Leaderboard"
            onClick={() => setActiveTab('leaderboard')}
          />
          <TabButton
            active={activeTab === 'routes'}
            label="Live Today"
            onClick={() => setActiveTab('routes')}
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="inline-flex rounded-2xl border border-[var(--border)] bg-[var(--panel-soft)] p-1">
            {PERIODS.map((periodOption) => (
              <button
                className={`rounded-xl px-4 py-2 text-xs font-black uppercase tracking-[0.2em] transition ${
                  period === periodOption
                    ? 'bg-[var(--orange)] text-white shadow-lg shadow-orange-900/20'
                    : 'text-[var(--muted)] hover:text-[var(--text)]'
                }`}
                key={periodOption}
                onClick={() => setPeriod(periodOption)}
                type="button"
              >
                {periodOption}
              </button>
            ))}
          </div>
          <button
            className="rounded-2xl border border-[var(--border)] bg-[var(--panel-soft)] px-4 py-2 text-sm font-bold text-[var(--muted-strong)] transition hover:border-[var(--blue)] hover:text-[var(--text)]"
            onClick={() => setIsDark((value) => !value)}
            type="button"
          >
            {isDark ? 'Light mode' : 'Dark mode'}
          </button>
        </div>
      </div>
    </section>
  )
}

function ScoreTile({ label, value, detail }) {
  return (
    <div className="metric-tile rounded-2xl p-3">
      <p className="text-[0.65rem] font-black uppercase tracking-[0.24em] text-[var(--muted)]">
        {label}
      </p>
      <p className="score-font mt-1 truncate text-2xl font-black uppercase text-[var(--text)]">
        {value}
      </p>
      <p className="mt-1 truncate text-xs font-semibold text-[var(--muted)]">{detail}</p>
    </div>
  )
}

function TabButton({ active, label, onClick }) {
  return (
    <button
      className={`rounded-xl px-4 py-2 text-sm font-black uppercase tracking-[0.18em] transition sm:px-5 ${
        active
          ? 'bg-[var(--blue)] text-white shadow-lg shadow-blue-950/30'
          : 'text-[var(--muted)] hover:text-[var(--text)]'
      }`}
      onClick={onClick}
      type="button"
    >
      {label}
    </button>
  )
}

function Leaderboard({
  expandedId,
  period,
  query,
  setExpandedId,
  setQuery,
  setSelectedTeammate,
  teammates,
  totalTeammates,
}) {
  return (
    <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_21rem]">
      <div className="scoreboard-card overflow-hidden rounded-[1.75rem]">
        <div className="flex flex-col gap-4 border-b border-[var(--border)] p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="score-font text-sm font-black uppercase tracking-[0.26em] text-[var(--orange)]">
              {period} Power Rankings
            </p>
            <h2 className="score-font mt-1 text-3xl font-black uppercase sm:text-4xl">
              Competitive Leaderboard
            </h2>
          </div>
          <label className="relative block w-full sm:max-w-xs">
            <span className="sr-only">Search by name or position</span>
            <input
              className="w-full rounded-2xl border border-[var(--border)] bg-[var(--panel-soft)] px-4 py-3 text-sm font-semibold text-[var(--text)] outline-none ring-0 placeholder:text-[var(--muted)] focus:border-[var(--orange)]"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search name or position"
              type="search"
              value={query}
            />
          </label>
        </div>

        <div className="table-scroll overflow-x-auto">
          <div className="min-w-[820px]">
            <div className="grid grid-cols-[5rem_1.7fr_0.8fr_repeat(4,0.75fr)_8rem] gap-3 border-b border-[var(--border)] px-5 py-3 text-xs font-black uppercase tracking-[0.18em] text-[var(--muted)]">
              <span>Rank</span>
              <span>Name</span>
              <span>Position</span>
              <span>Score</span>
              <span>Resi AJS</span>
              <span>Resi Rev</span>
              <span>Reviews</span>
              <span>Tier</span>
            </div>

            {teammates.map((teammate) => (
              <LeaderboardRow
                expanded={expandedId === teammate.id}
                key={teammate.id}
                onOpenProfile={() => setSelectedTeammate(teammate)}
                onToggle={() => setExpandedId(expandedId === teammate.id ? '' : teammate.id)}
                teammate={teammate}
              />
            ))}
          </div>
        </div>

        {!teammates.length ? (
          <div className="p-8 text-center text-sm font-semibold text-[var(--muted)]">
            No teammates match that search.
          </div>
        ) : null}
      </div>

      <aside className="grid gap-5">
        <TopThreeCard teammates={teammates.slice(0, 3)} />
        <ScoringCard totalTeammates={totalTeammates} />
      </aside>
    </section>
  )
}

function LeaderboardRow({ expanded, onOpenProfile, onToggle, teammate }) {
  return (
    <div className="border-b border-[var(--border)] last:border-b-0">
      <button
        className="leader-row grid w-full grid-cols-[5rem_1.7fr_0.8fr_repeat(4,0.75fr)_8rem] items-center gap-3 px-5 py-4 text-left"
        onClick={onToggle}
        type="button"
      >
        <div className="flex items-center gap-2">
          <span className="score-font text-3xl font-black text-[var(--orange)]">
            {teammate.medal || `#${teammate.rank}`}
          </span>
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="truncate text-base font-black text-[var(--text)]">{teammate.name}</p>
            {teammate.rank === 1 ? (
              <span className="rounded-full bg-[var(--orange-soft)] px-2 py-0.5 text-[0.65rem] font-black uppercase tracking-[0.16em] text-[var(--orange)]">
                Top Hauler
              </span>
            ) : null}
          </div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--muted)]">
            {teammate.title}
          </p>
        </div>
        <span className="text-sm font-bold text-[var(--muted-strong)]">{teammate.position}</span>
        <span className="score-font text-3xl font-black text-[var(--blue)]">{teammate.score}</span>
        <span className="font-bold">{formatAjs(teammate.resiAjs)}</span>
        <span className="font-bold">{compactCurrency(teammate.residentialRevenue)}</span>
        <span className="font-bold">{formatPercent(teammate.reviewsPct)}</span>
        <span
          className={`rounded-full border px-3 py-1 text-center text-xs font-black uppercase tracking-[0.14em] badge-${teammate.tier}`}
        >
          {getTierLabel(teammate.tier)}
        </span>
      </button>

      {expanded ? (
        <div className="grid gap-4 bg-[var(--panel-soft)] px-5 py-5 md:grid-cols-[1.2fr_0.8fr]">
          <div className="grid gap-3 sm:grid-cols-4">
            <MiniStat label="Total Revenue" value={formatCurrency(teammate.totalRevenue)} />
            <MiniStat label="Total Jobs" value={formatNumber(teammate.totalJobs)} />
            <MiniStat label="Rev / Hour" value={formatCurrency(teammate.revenuePerHour)} />
            <MiniStat label="Truck+" value={formatPercent(teammate.fullTruckPct)} />
            <MiniStat label="Resi Jobs" value={formatNumber(teammate.resiJobs)} />
            <MiniStat label="Resi > $1K" value={formatNumber(teammate.resiOver1KCount)} />
            <MiniStat label="Cancels" value={formatPercent(teammate.cancelsPct, 1)} />
            <MiniStat label="Complaints" value={formatPercent(teammate.complaintsPct, 1)} />
          </div>
          <div className="flex flex-col justify-between gap-4 rounded-2xl border border-[var(--border)] bg-[var(--panel)] p-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-[var(--muted)]">
                Score Build
              </p>
              <ScoreBar label="Resi AJS" value={teammate.normalized.resiAjs} />
              <ScoreBar label="Resi Revenue" value={teammate.normalized.residentialRevenue} />
              <ScoreBar label="Reviews" value={teammate.normalized.reviewsPct} />
              <ScoreBar label="Low Issues" value={teammate.normalized.lowIssueRate} />
            </div>
            <button
              className="rounded-2xl bg-[var(--orange)] px-4 py-3 text-sm font-black uppercase tracking-[0.18em] text-white transition hover:brightness-110"
              onClick={(event) => {
                event.stopPropagation()
                onOpenProfile()
              }}
              type="button"
            >
              Open Profile
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function MiniStat({ label, value }) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--panel)] p-4">
      <p className="text-[0.65rem] font-black uppercase tracking-[0.2em] text-[var(--muted)]">
        {label}
      </p>
      <p className="score-font mt-1 text-2xl font-black text-[var(--text)]">{value}</p>
    </div>
  )
}

function ScoreBar({ label, value }) {
  const safeValue = Math.max(0, Math.min(100, parseNumber(value)))
  return (
    <div className="mt-3">
      <div className="mb-1 flex items-center justify-between text-xs font-bold text-[var(--muted-strong)]">
        <span>{label}</span>
        <span>{safeValue.toFixed(0)}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-[var(--panel-soft)]">
        <div
          className="h-full rounded-full bg-gradient-to-r from-[var(--orange)] to-[var(--blue)]"
          style={{ width: `${safeValue}%` }}
        />
      </div>
    </div>
  )
}

function TopThreeCard({ teammates }) {
  return (
    <div className="scoreboard-card rounded-[1.75rem] p-5">
      <p className="score-font text-sm font-black uppercase tracking-[0.26em] text-[var(--blue)]">
        Podium
      </p>
      <h3 className="score-font mt-1 text-3xl font-black uppercase">Top 3</h3>
      <div className="mt-4 grid gap-3">
        {teammates.map((teammate) => (
          <div
            className="flex items-center justify-between rounded-2xl border border-[var(--border)] bg-[var(--panel-soft)] p-3"
            key={teammate.id}
          >
            <div className="min-w-0">
              <p className="truncate font-black">
                <span className="mr-2">{teammate.medal}</span>
                {teammate.name}
              </p>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--muted)]">
                {teammate.position}
              </p>
            </div>
            <span className="score-font text-3xl font-black text-[var(--orange)]">
              {teammate.score}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

function ScoringCard({ totalTeammates }) {
  return (
    <div className="glass-panel rounded-[1.75rem] p-5">
      <p className="score-font text-sm font-black uppercase tracking-[0.26em] text-[var(--orange)]">
        Formula
      </p>
      <h3 className="score-font mt-1 text-3xl font-black uppercase">0-100 Score</h3>
      <div className="mt-4 space-y-3 text-sm font-semibold text-[var(--muted-strong)]">
        <FormulaRow label="Resi AJS" value="45%" />
        <FormulaRow label="Residential Revenue" value="30%" />
        <FormulaRow label="Google 9-10 Reviews" value="15%" />
        <FormulaRow label="Cancels + Complaints" value="10% penalty" />
      </div>
      <p className="mt-4 text-xs leading-relaxed text-[var(--muted)]">
        Every metric is min-max normalized across the active roster. Green badges represent the
        top 25%, yellow the middle 50%, and red the bottom 25% of {totalTeammates || 'the'} tracked
        teammates.
      </p>
    </div>
  )
}

function FormulaRow({ label, value }) {
  return (
    <div className="flex items-center justify-between rounded-2xl border border-[var(--border)] bg-[var(--panel-soft)] px-4 py-3">
      <span>{label}</span>
      <span className="score-font text-xl font-black text-[var(--blue)]">{value}</span>
    </div>
  )
}

function LiveRoutes({ loading, refreshData, routes, routeTotals, updatedAt }) {
  return (
    <section className="grid gap-5">
      <div className="scoreboard-card rounded-[1.75rem] p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="score-font text-sm font-black uppercase tracking-[0.26em] text-[var(--orange)]">
              60s Auto Refresh
            </p>
            <h2 className="score-font mt-1 text-3xl font-black uppercase sm:text-4xl">
              Live Daily Route Tracker
            </h2>
            <p className="mt-2 text-sm font-semibold text-[var(--muted)]">
              Westside AW routes and Eastside AE routes, pulled from today&apos;s live sheets.
            </p>
          </div>
          <button
            className="rounded-2xl border border-[var(--border)] bg-[var(--blue)] px-5 py-3 text-sm font-black uppercase tracking-[0.18em] text-white transition hover:brightness-110 disabled:cursor-wait disabled:opacity-70"
            disabled={loading}
            onClick={refreshData}
            type="button"
          >
            {loading ? 'Refreshing' : 'Refresh Now'}
          </button>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <MiniStat label="Routes" value={formatNumber(routeTotals.routeCount)} />
          <MiniStat label="Team Revenue" value={formatCurrency(routeTotals.totalRevenue)} />
          <MiniStat label="Resi Revenue" value={formatCurrency(routeTotals.residentialRevenue)} />
          <MiniStat label="Jobs" value={formatNumber(routeTotals.jobs)} />
          <MiniStat label="Avg AJS" value={formatAjs(routeTotals.avgAjs)} />
        </div>
        <p className="mt-4 text-xs font-bold uppercase tracking-[0.16em] text-[var(--muted)]">
          Last pulled: {formatUpdated(updatedAt)}
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {routes.map((route) => (
          <RouteCard key={route.id} route={route} />
        ))}
      </div>
    </section>
  )
}

function RouteCard({ route }) {
  const revenueGood = route.totalRevenue >= ROUTE_STANDARDS.totalRevenue
  const ajsGood = route.ajs >= ROUTE_STANDARDS.ajs
  const resiAjsGood = route.resiAjs >= ROUTE_STANDARDS.resiAjs
  const truckPlusGood = route.truckPlusPct >= ROUTE_STANDARDS.truckPlusPct
  const statusGood = [revenueGood, ajsGood, resiAjsGood, truckPlusGood].filter(Boolean).length >= 3

  return (
    <article className="scoreboard-card overflow-hidden rounded-[1.75rem]">
      <div
        className={`border-b px-5 py-4 ${
          statusGood
            ? 'border-[rgba(40,209,124,0.34)] bg-[var(--green-soft)]'
            : 'border-[rgba(255,83,100,0.34)] bg-[var(--red-soft)]'
        }`}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-[var(--muted)]">
              {route.side} - Truck {route.truckNumber || 'TBD'}
            </p>
            <h3 className="score-font mt-1 text-5xl font-black uppercase">{route.routeCode}</h3>
          </div>
          <span
            className={`rounded-full border px-3 py-1 text-xs font-black uppercase tracking-[0.16em] ${
              statusGood ? 'badge-green' : 'badge-red'
            }`}
          >
            {statusGood ? 'Above Standard' : 'Below Standard'}
          </span>
        </div>
        <p className="mt-3 text-sm font-bold text-[var(--muted-strong)]">
          {route.teammates.length ? route.teammates.join(' / ') : 'No teammates listed'}
        </p>
      </div>

      <div className="grid gap-3 p-5 sm:grid-cols-2">
        <RouteMetric
          good={revenueGood}
          label="Revenue"
          standard={formatCurrency(ROUTE_STANDARDS.totalRevenue)}
          value={formatCurrency(route.totalRevenue)}
        />
        <RouteMetric
          good={route.residentialRevenue >= ROUTE_STANDARDS.totalRevenue * 0.65}
          label="Resi Revenue"
          standard="65% of rev"
          value={formatCurrency(route.residentialRevenue)}
        />
        <RouteMetric
          good={route.jobs > 0}
          label="Jobs"
          standard="Active"
          value={formatNumber(route.jobs)}
        />
        <RouteMetric
          good={ajsGood}
          label="AJS"
          standard={formatCurrency(ROUTE_STANDARDS.ajs)}
          value={formatAjs(route.ajs)}
        />
        <RouteMetric
          good={resiAjsGood}
          label="Resi AJS"
          standard={formatCurrency(ROUTE_STANDARDS.resiAjs)}
          value={formatAjs(route.resiAjs)}
        />
        <RouteMetric
          good={truckPlusGood}
          label="Truck+"
          standard={formatPercent(ROUTE_STANDARDS.truckPlusPct)}
          value={formatPercent(route.truckPlusPct)}
        />
      </div>
    </article>
  )
}

function RouteMetric({ good, label, standard, value }) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--panel-soft)] p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[0.65rem] font-black uppercase tracking-[0.2em] text-[var(--muted)]">
          {label}
        </p>
        <span
          className={`rounded-full border px-2 py-0.5 text-[0.62rem] font-black uppercase tracking-[0.12em] ${
            good ? 'badge-green' : 'badge-red'
          }`}
        >
          {good ? 'Green' : 'Red'}
        </span>
      </div>
      <p className="score-font mt-2 text-3xl font-black text-[var(--text)]">{value}</p>
      <p className="mt-1 text-xs font-bold text-[var(--muted)]">Standard: {standard}</p>
    </div>
  )
}

function ProfileModal({ onClose, teammate }) {
  const trend = buildTrend(teammate)
  const achievements = getAchievements(teammate)

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-6 backdrop-blur-sm"
      onMouseDown={onClose}
      role="presentation"
    >
      <section
        aria-modal="true"
        className="scoreboard-card max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-[2rem]"
        onMouseDown={(event) => event.stopPropagation()}
        role="dialog"
      >
        <div className="flex flex-col gap-4 border-b border-[var(--border)] p-5 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="score-font text-sm font-black uppercase tracking-[0.26em] text-[var(--orange)]">
              Rank #{teammate.rank} - {teammate.title}
            </p>
            <h2 className="score-font mt-1 text-4xl font-black uppercase sm:text-5xl">
              {teammate.name}
            </h2>
            <p className="mt-2 text-sm font-bold uppercase tracking-[0.18em] text-[var(--muted)]">
              {teammate.position}
            </p>
          </div>
          <button
            className="rounded-2xl border border-[var(--border)] bg-[var(--panel-soft)] px-4 py-2 text-sm font-black uppercase tracking-[0.18em] text-[var(--muted-strong)] transition hover:border-[var(--orange)] hover:text-[var(--text)]"
            onClick={onClose}
            type="button"
          >
            Close
          </button>
        </div>

        <div className="grid gap-5 p-5 lg:grid-cols-[1fr_1.2fr]">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
            <MiniStat label="Combined Score" value={teammate.score} />
            <MiniStat label="Resi AJS" value={formatAjs(teammate.resiAjs)} />
            <MiniStat label="Resi Revenue" value={formatCurrency(teammate.residentialRevenue)} />
            <MiniStat label="Reviews 9-10%" value={formatPercent(teammate.reviewsPct)} />
            <MiniStat label="Cancels" value={`${formatNumber(teammate.cancelsCount)} (${formatPercent(teammate.cancelsPct, 1)})`} />
            <MiniStat label="Complaints" value={`${formatNumber(teammate.complaintsCount)} (${formatPercent(teammate.complaintsPct, 1)})`} />
          </div>

          <div className="rounded-3xl border border-[var(--border)] bg-[var(--panel-soft)] p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="score-font text-sm font-black uppercase tracking-[0.22em] text-[var(--blue)]">
                  Monthly Trend
                </p>
                <h3 className="score-font text-3xl font-black uppercase">Resi AJS Pace</h3>
              </div>
              <div className="flex flex-wrap gap-2">
                {achievements.map((achievement) => (
                  <span
                    className="rounded-full border border-[var(--border)] bg-[var(--orange-soft)] px-3 py-1 text-xs font-black uppercase tracking-[0.12em] text-[var(--orange)]"
                    key={achievement}
                  >
                    {achievement}
                  </span>
                ))}
              </div>
            </div>
            <div className="mt-5 h-72">
              <ResponsiveContainer height="100%" width="100%">
                <BarChart data={trend}>
                  <CartesianGrid stroke="rgba(127,154,186,0.16)" vertical={false} />
                  <XAxis
                    axisLine={false}
                    dataKey="month"
                    tick={{ fill: 'var(--muted)', fontSize: 12, fontWeight: 700 }}
                    tickLine={false}
                  />
                  <YAxis
                    axisLine={false}
                    tick={{ fill: 'var(--muted)', fontSize: 12, fontWeight: 700 }}
                    tickFormatter={(value) => `$${Math.round(value / 100) / 10}k`}
                    tickLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      background: '#081526',
                      border: '1px solid rgba(125, 164, 208, 0.22)',
                      borderRadius: 16,
                      color: '#f7fbff',
                    }}
                    formatter={(value) => [formatCurrency(value), 'Resi AJS']}
                    labelStyle={{ color: '#ff7a1a', fontWeight: 900 }}
                  />
                  <Bar dataKey="resiAjs" fill="#1f9bff" radius={[10, 10, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <p className="mt-3 text-xs leading-relaxed text-[var(--muted)]">
              Trend bars use the current sheet metrics as the baseline until historical monthly
              ranges are added to the Google Sheet.
            </p>
          </div>
        </div>
      </section>
    </div>
  )
}

function buildRouteTotals(routes) {
  const totals = routes.reduce(
    (summary, route) => ({
      routeCount: summary.routeCount + 1,
      totalRevenue: summary.totalRevenue + parseNumber(route.totalRevenue),
      residentialRevenue: summary.residentialRevenue + parseNumber(route.residentialRevenue),
      jobs: summary.jobs + parseNumber(route.jobs),
    }),
    {
      routeCount: 0,
      totalRevenue: 0,
      residentialRevenue: 0,
      jobs: 0,
    },
  )

  return {
    ...totals,
    avgAjs: safeDivide(totals.totalRevenue, totals.jobs),
  }
}

function formatUpdated(updatedAt) {
  if (!updatedAt) {
    return 'pending'
  }

  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  }).format(updatedAt)
}
