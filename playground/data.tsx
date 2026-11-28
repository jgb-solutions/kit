import { icons, type Activity } from '../src/admin'

/** Sample data for the playground: a made-up app with made-up people (example.com addresses only). */

export type Person = {
  id: string
  name: string
  email: string
  role: 'Admin' | 'Editor' | 'Member'
  status: 'active' | 'invited' | 'suspended'
  joined: string
}

export const PEOPLE: Person[] = [
  { id: 'p1', name: 'Priya Nair', email: 'priya@example.com', role: 'Editor', status: 'active', joined: 'Today' },
  { id: 'p2', name: 'Jonas Lind', email: 'jonas@example.com', role: 'Admin', status: 'active', joined: '12 Mar' },
  { id: 'p3', name: 'Ada Okafor', email: 'ada@example.com', role: 'Member', status: 'invited', joined: '9 Mar' },
  { id: 'p4', name: 'Leo Martin', email: 'leo@example.com', role: 'Member', status: 'suspended', joined: '2 Feb' },
  { id: 'p5', name: 'Sun-hee Kim', email: 'sunhee@example.com', role: 'Member', status: 'active', joined: '28 Jan' },
  { id: 'p6', name: 'Tomás Ruiz', email: 'tomas@example.com', role: 'Editor', status: 'active', joined: '14 Jan' },
  { id: 'p7', name: 'Amara Diallo', email: 'amara@example.com', role: 'Member', status: 'invited', joined: '3 Jan' },
  { id: 'p8', name: 'Noah Fischer', email: 'noah@example.com', role: 'Member', status: 'active', joined: '19 Dec' },
]

export const VISITS = {
  day: [
    { label: '6 am', value: 820 },
    { label: '9 am', value: 2140 },
    { label: '12 pm', value: 3010 },
    { label: '3 pm', value: 2650 },
    { label: '6 pm', value: 3420 },
    { label: '9 pm', value: 2980 },
  ],
  week: [
    { label: 'Mon', value: 5200 },
    { label: 'Tue', value: 5900 },
    { label: 'Wed', value: 5400 },
    { label: 'Thu', value: 7300 },
    { label: 'Fri', value: 8600 },
    { label: 'Sat', value: 7900 },
    { label: 'Sun', value: 8620 },
  ],
  month: [
    { label: 'W1', value: 31200 },
    { label: 'W2', value: 35800 },
    { label: 'W3', value: 41300 },
    { label: 'W4', value: 48920 },
  ],
} as const

export const ACTIVITY: Activity[] = [
  { id: 'a1', icon: <icons.doc />, text: 'Jonas Lind published “Spring menu”', time: '12 minutes ago', day: 'Today' },
  { id: 'a2', icon: <icons.plus />, tone: 'good', text: 'Priya Nair joined as Editor', time: '1 hour ago', day: 'Today' },
  { id: 'a3', icon: <icons.check />, tone: 'warn', text: 'The report on “Weekend hours” was closed', time: '3 hours ago', day: 'Today' },
  { id: 'a4', icon: <icons.block />, tone: 'bad', text: 'Leo Martin was suspended by Maya', time: 'Yesterday, 4:12 pm', day: 'Yesterday' },
]
