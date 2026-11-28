/**
 * @jgb-solutions/admin: the admin panel kit for JGB Solutions apps. Import the stylesheet once
 * (`import '@jgb-solutions/admin/styles.css'`), wrap the admin in <AdminShell>, and build pages from
 * the blocks. Components take data and callbacks; the app fetches, checks permissions on the server
 * and decides what happens.
 */
export { AdminShell, type AdminShellProps } from './shell/AdminShell'
export { Sidebar, type SidebarProps, type AppIdentity } from './shell/Sidebar'
export { Dock, type DockProps } from './shell/Dock'
export { PageHeader, TopSearch, type PageHeaderProps, type TopSearchProps } from './shell/PageHeader'
export { ThemeToggle } from './shell/ThemeToggle'
export { plainLink, type NavItem, type NavSection, type LinkProps, type RenderLink } from './shell/nav'
export { useAdminTheme, type Theme, type ThemeChoice } from './theme'
export { Button, IconButton, type ButtonProps, type IconButtonProps } from './ui/Button'
export { Avatar, initials, type AvatarProps } from './ui/Avatar'
export { icons, type IconName } from './icons'
export { contrastRatio, inkOn } from './contrast'
export { Bento, Tile, type TileProps } from './blocks/Tile'
export { StatTile, Meter, AvatarStack, DeltaText, type StatTileProps, type Delta } from './blocks/Stat'
export { HeroChartTile, type HeroChartTileProps } from './blocks/Hero'
export { LineChart, type LineChartProps, type ChartPoint } from './blocks/LineChart'
export { SegmentedControl, type SegmentedOption } from './blocks/Segmented'
export { DataTable, PersonCell, RowAction, type Column, type DataTableProps } from './blocks/DataTable'
export { byNumber, byText, nextSort, sortRows, type ColumnSort, type SortDirection, type TableSort } from './blocks/sorting'
export { FilterTabs, type FilterOption } from './blocks/Filters'
export { PAGE_SIZES, PageSize, Pagination, type PageSizeProps, type PaginationProps } from './blocks/Pagination'
export { StatusBadge, PEOPLE_STATUS, type StatusTone } from './blocks/Status'
export { ActivityFeed, type Activity, type ActivityFeedProps } from './blocks/ActivityFeed'
export { Field, TextInput, TextArea, Select, Checkbox, Switch, type FieldProps, type FieldIds, type SelectOption } from './forms/Field'
export { ConfirmDialog, type ConfirmDialogProps } from './forms/ConfirmDialog'
export { useToast } from './forms/Toast'
export { RolePicker, BanControl, type RolePickerProps, type RoleOption, type BanControlProps } from './forms/People'
export { BarChart, type BarChartProps, type BarSeries } from './blocks/BarChart'
