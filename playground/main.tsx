import { useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import {
  ActivityFeed,
  AdminShell,
  Avatar,
  AvatarStack,
  BanControl,
  BarChart,
  Bento,
  Button,
  Checkbox,
  byText,
  DataTable,
  FilterTabs,
  HeroChartTile,
  IconButton,
  icons,
  LineChart,
  Meter,
  PageHeader,
  Pagination,
  PEOPLE_STATUS,
  PersonCell,
  RolePicker,
  RowAction,
  sortRows,
  Select,
  StatTile,
  StatusBadge,
  Switch,
  TextArea,
  TextInput,
  ThemeToggle,
  Tile,
  TopSearch,
  useToast,
  type Column,
  type NavSection,
  type RenderLink,
  type TableSort,
} from '../src/admin'
import { ACTIVITY, PEOPLE, VISITS, type Person } from './data'

/**
 * The playground: what an app builds with the kit, on sample data (a made-up app, "Tidepool").
 * Pages switch through the hash, as a router would. `?state=loading` or `?state=empty` shows the
 * loading and empty states.
 */
const PAGES = ['overview', 'users', 'content', 'reports', 'analytics', 'settings'] as const
type Page = (typeof PAGES)[number]
const STATE = new URLSearchParams(location.search).get('state')

function nav(current: Page): NavSection[] {
  const item = (key: Page, label: string, Icon: (typeof icons)[keyof typeof icons], count?: number) => ({
    key,
    label,
    href: `#${key}`,
    icon: <Icon />,
    count,
    current: current === key,
  })
  return [
    {
      label: 'Manage',
      items: [
        item('overview', 'Overview', icons.home),
        item('users', 'Users', icons.users, 2481),
        item('content', 'Content', icons.box),
        item('reports', 'Reports', icons.flag, 7),
        item('analytics', 'Analytics', icons.chart),
      ],
    },
    { placement: 'end', items: [item('settings', 'Settings', icons.gear)] },
  ]
}

const pageOf = (hash: string): Page => PAGES.find((page) => `#${page}` === hash) ?? 'overview'

const hashLink =
  (go: (page: Page) => void): RenderLink =>
  ({ item, children, ...rest }) => (
    <a
      href={item.href}
      {...rest}
      onClick={(event) => {
        event.preventDefault()
        history.replaceState(null, '', `${location.search}${item.href}`)
        go(pageOf(item.href))
      }}
    >
      {children}
    </a>
  )

type Filter = 'all' | 'admins' | 'suspended'

const ROLES = [
  { value: 'Admin', label: 'Admin' },
  { value: 'Editor', label: 'Editor' },
  { value: 'Member', label: 'Member' },
] as const
const pause = () => new Promise((resolve) => setTimeout(resolve, 250))

function UsersTile({ span, pageSize: firstSize }: { span: number; pageSize: number }) {
  const [pageSize, setPageSize] = useState(firstSize)
  const toast = useToast()
  const [people, setPeople] = useState(PEOPLE)
  const [flash, setFlash] = useState<ReadonlySet<string>>(new Set())
  const update = (id: string, change: Partial<Person>) => {
    setPeople((all) => all.map((p) => (p.id === id ? { ...p, ...change } : p)))
    setFlash(new Set([id]))
    setTimeout(() => setFlash(new Set()), 1000)
  }
  const [filter, setFilter] = useState<Filter>('all')
  const [query, setQuery] = useState(STATE === 'empty' ? 'zebra' : '')
  const [page, setPage] = useState(1)
  const [sort, setSort] = useState<TableSort | undefined>(undefined)
  const filtered = useMemo(
    () =>
      people
        .filter((p) => (filter === 'admins' ? p.role === 'Admin' : filter === 'suspended' ? p.status === 'suspended' : true))
        .filter((p) => !query || `${p.name} ${p.email}`.toLowerCase().includes(query.toLowerCase())),
    [people, filter, query],
  )
  const columns: Column<Person>[] = [
    {
      key: 'person',
      header: 'Person',
      sort: { compare: byText((p) => p.name), ascLabel: 'A to Z', descLabel: 'Z to A' },
      cell: (p) => <PersonCell name={p.name} detail={p.email} avatar={<Avatar name={p.name} shape="soft" />} />,
    },
    {
      key: 'role',
      header: 'Role',
      sort: { compare: byText((p) => p.role) },
      phone: { order: 3 },
      cell: (p) => (
        <RolePicker
          name={p.name}
          roles={ROLES}
          value={p.role}
          confirm={{ Admin: 'Admins can change everyone’s role and suspend people.' }}
          onChange={async (role) => {
            await pause()
            update(p.id, { role })
            toast.done(`${p.name} is now ${role === 'Admin' || role === 'Editor' ? 'an' : 'a'} ${role}.`)
          }}
        />
      ),
    },
    {
      key: 'status',
      header: 'Status',
      cell: (p) => <StatusBadge tone={PEOPLE_STATUS[p.status].tone}>{PEOPLE_STATUS[p.status].label}</StatusBadge>,
      phone: { order: 2, align: 'end' },
    },
    {
      key: 'joined',
      header: 'Joined',
      cell: (p) => <span className="ja-muted">{p.joined}</span>,
      phone: { hidden: true },
    },
    {
      key: 'action',
      header: '',
      srHeader: 'Actions',
      align: 'end',
      phone: { order: 4, align: 'end' },
      cell: (p) =>
        p.status === 'invited' ? (
          <RowAction aria-label={`Resend invite to ${p.name}`} onClick={() => toast.done(`Invite sent to ${p.name} again.`)}>
            Resend invite
          </RowAction>
        ) : (
          <BanControl
            name={p.name}
            suspended={p.status === 'suspended'}
            onSuspend={async () => {
              await pause()
              update(p.id, { status: 'suspended' })
              toast.done(`Suspended ${p.name}.`)
            }}
            onRestore={async () => {
              await pause()
              update(p.id, { status: 'active' })
              toast.done(`Restored ${p.name}.`)
            }}
          />
        ),
    },
  ]
  const column = columns.find((c) => c.key === sort?.key)
  const rows = sort ? sortRows(filtered, column?.sort?.compare, sort.direction) : filtered
  const pages = Math.max(1, Math.ceil(rows.length / pageSize))
  const shown = rows.slice((page - 1) * pageSize, page * pageSize)
  return (
    <Tile
      span={span}
      title="Users"
      actions={
        <>
          <FilterTabs<Filter>
            label="Show"
            options={[
              { value: 'all', label: 'All' },
              { value: 'admins', label: 'Admins' },
              { value: 'suspended', label: 'Suspended' },
            ]}
            value={filter}
            onChange={(value) => {
              setFilter(value)
              setPage(1)
            }}
          />
          <TopSearch
            className="ja-filter-search"
            label="Search by name or email"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setPage(1)
            }}
          />
        </>
      }
    >
      <DataTable
        label="Users"
        columns={columns}
        rows={shown}
        rowKey={(p) => p.id}
        flash={flash}
        loading={STATE === 'loading'}
        sort={sort}
        onSortChange={(next) => {
          setSort(next)
          setPage(1)
        }}
        empty={
          <>
            No people match “{query}”.{' '}
            <button type="button" className="ja-row-action" onClick={() => setQuery('')}>
              Clear the search
            </button>
          </>
        }
      />
      <Pagination
        page={page}
        pages={pages}
        onPage={setPage}
        label="User pages"
        pageSize={pageSize}
        pageSizes={[4, 6, 12]}
        onPageSize={(size) => {
          setPageSize(size)
          setPage(1)
        }}
        summary={rows.length ? `${(page - 1) * pageSize + 1}–${(page - 1) * pageSize + shown.length} of ${rows.length} people` : undefined}
      />
    </Tile>
  )
}

function Overview() {
  const [period, setPeriod] = useState<'day' | 'week' | 'month'>('week')
  const totals = { day: '3,420', week: '48,920', month: '157,220' }
  return (
    <Bento aria-label="Tidepool at a glance">
      <HeroChartTile
        label={`Visits this ${period}`}
        value={totals[period]}
        delta={{ value: '+12.4%', direction: 'up', label: `on last ${period}` }}
        data={[...VISITS[period]]}
        chartLabel={`Visits per ${period === 'day' ? 'hour today' : period === 'week' ? 'day this week' : 'week this month'}`}
        periods={{
          label: 'Period',
          options: [
            { value: 'day', label: 'Day' },
            { value: 'week', label: 'Week' },
            { value: 'month', label: 'Month' },
          ],
          value: period,
          onChange: setPeriod,
        }}
      />
      <StatTile
        span={4}
        label="Active users"
        value="2,481"
        note="72% of everyone with an account"
        delta={{ value: 'up 8.2%', direction: 'up' }}
      >
        <Meter value={0.72} label="72% of everyone with an account" />
      </StatTile>
      <StatTile span={3} label="New sign-ups" value="316">
        <AvatarStack
          names={['Priya Nair', 'Ada Okafor', 'Sun-hee Kim']}
          more={313}
          label="Priya Nair, Ada Okafor, Sun-hee Kim and 313 others"
        />
      </StatTile>
      <StatTile span={3} phoneSpan={1} tone="sun" label="Open reports" value="7" note="3 fewer than Monday" />
      <StatTile span={4} phoneSpan={1} label="Pages published" value="94" note="Busiest day: Thursday, 22 pages" />
      <UsersTile span={8} pageSize={4} />
      <Tile span={4} title="Latest activity">
        <ActivityFeed items={STATE === 'empty' ? [] : ACTIVITY} loading={STATE === 'loading'} />
      </Tile>
    </Bento>
  )
}

function Analytics() {
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  return (
    <Bento aria-label="Analytics">
      <Tile span={7} title="Sign-ups per day">
        <BarChart
          labels={days}
          series={[
            { label: 'This week', values: [38, 52, 41, 66, 58, 31, 30] },
            { label: 'Last week', values: [29, 44, 47, 50, 41, 22, 27] },
          ]}
          label="Sign-ups per day, this week and last"
        />
      </Tile>
      <StatTile
        span={5}
        label="Sign-ups this week"
        value="316"
        delta={{ value: '+22%', direction: 'up', label: 'on last week' }}
        note="Busiest day: Thursday"
      />
      <Tile span={5} title="Reports opened">
        <BarChart
          labels={['Spam', 'Abuse', 'Copyright', 'Other']}
          series={[{ label: 'This month', values: [14, 5, 3, 7] }]}
          label="Reports opened this month, by reason"
          height={150}
        />
      </Tile>
      <Tile span={7} title="Pages published per week">
        <LineChart
          color="brand"
          data={[
            { label: 'W1', value: 61 },
            { label: 'W2', value: 72 },
            { label: 'W3', value: 68 },
            { label: 'W4', value: 94 },
          ]}
          label="Pages published per week this month"
        />
      </Tile>
    </Bento>
  )
}

/** Each page's header. */
const HEADERS: Partial<Record<Page, [string, string]>> = {
  users: ['Users', 'Everyone with an account.'],
  settings: ['Settings', 'How Tidepool works for everyone.'],
  analytics: ['Analytics', 'How Tidepool is doing, week by week.'],
}

function Settings() {
  const toast = useToast()
  const [name, setName] = useState('Tidepool')
  const [signUps, setSignUps] = useState(true)
  const [digest, setDigest] = useState(false)
  const error = name.trim() ? undefined : 'Enter the site’s name.'
  return (
    <Bento aria-label="Settings">
      <Tile span={7} title="Site">
        <form
          noValidate
          onSubmit={(event) => {
            event.preventDefault()
            if (!error) toast.done('Settings saved.')
          }}
        >
          <TextInput label="Site name" value={name} onChange={(e) => setName(e.target.value)} error={error} required />
          <TextInput label="Contact email" type="email" defaultValue="hello@example.com" hint="Shown on the contact page." />
          <Select
            label="Time zone"
            defaultValue="utc"
            options={[
              { value: 'utc', label: 'UTC' },
              { value: 'ny', label: 'New York (UTC−5)' },
              { value: 'tokyo', label: 'Tokyo (UTC+9)' },
            ]}
          />
          <TextArea label="Welcome message" defaultValue="Welcome to Tidepool." hint="Up to 200 characters." maxLength={200} />
          <Checkbox label="Show the welcome message to new people" hint="Once, on their first visit." defaultChecked />
          <Button type="submit">Save settings</Button>
        </form>
      </Tile>
      <Tile span={5} title="Sign-in">
        <Switch label="Open sign-up" hint="Anyone can create an account." checked={signUps} onChange={setSignUps} />
        <Switch label="Weekly digest email" hint="To admins, on Mondays." checked={digest} onChange={setDigest} />
        <Switch label="Passkeys" hint="Always on." checked disabled onChange={() => {}} />
        <Button variant="quiet" onClick={() => toast.error('Couldn’t reach the server. Check the connection and try again.')}>
          Show an error toast
        </Button>
      </Tile>
    </Bento>
  )
}

function Playground() {
  const [page, setPage] = useState<Page>(() => pageOf(location.hash))
  return (
    <AdminShell
      app={{ name: 'Tidepool', mark: 'T' }}
      brand="#6b4ce6"
      nav={nav(page)}
      dockItems={['overview', 'users', 'reports', 'settings']}
      user={{ name: 'Maya Reyes', role: 'Admin' }}
      renderLink={hashLink(setPage)}
      mobileActions={<IconButton label="Notifications" icon={<icons.bell />} dot />}
      sidebarFooter={<ThemeToggle tone="night" />}
    >
      <PageHeader
        title={HEADERS[page]?.[0] ?? "Hi Maya, it's a good week."}
        description={HEADERS[page]?.[1] ?? 'Tidepool at a glance.'}
        tools={
          <>
            <TopSearch label="Search anything" />
            <IconButton label="Notifications" icon={<icons.bell />} dot />
          </>
        }
        actions={<Button icon={<icons.plus />}>Invite people</Button>}
      />
      {page === 'users' ? (
        <Bento aria-label="Users">
          <UsersTile span={12} pageSize={6} />
        </Bento>
      ) : page === 'settings' ? (
        <Settings />
      ) : page === 'analytics' ? (
        <Analytics />
      ) : (
        <Overview />
      )}
    </AdminShell>
  )
}

createRoot(document.getElementById('root')!).render(<Playground />)
