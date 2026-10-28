import { NavLink, Outlet, useLocation } from 'react-router-dom'

function navClass(active: boolean) {
  return active ? 'active' : undefined
}

export function Layout() {
  const { pathname } = useLocation()
  const onTasks =
    pathname === '/' ||
    (pathname.startsWith('/tasks/') &&
      pathname !== '/tasks/new' &&
      !pathname.endsWith('/edit'))
  const onCreate = pathname === '/tasks/new'

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark" aria-hidden />
          <div>
            <strong>DelayFlow</strong>
            <p>分布式延时任务调度</p>
          </div>
        </div>
        <nav className="nav">
          <NavLink to="/" end className={() => navClass(onTasks)}>
            任务
          </NavLink>
          <NavLink to="/tasks/new" className={() => navClass(onCreate)}>
            创建
          </NavLink>
        </nav>
      </header>
      <main className="main">
        <Outlet />
      </main>
    </div>
  )
}
