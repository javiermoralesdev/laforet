import { Route, Router, type RouteSectionProps } from "@solidjs/router"
import { lazy } from "solid-js"
import './App.scss'

const Home = lazy(() => import("./pages/Home"))
const SignUpForm = lazy(() => import("./lib/SignUpForm"))
const Entry = lazy(() => import("./pages/Entry"))
const EditEntry = lazy(() => import("./pages/EditEntry"))
const Write = lazy(() => import("./pages/Write"))
const NotFound = lazy(() => import("./pages/NotFround"))

function RootLayout(props: RouteSectionProps) {
  return (
    <div class="appLayout">
      <main class="appMain">{props.children}</main>
      <footer class="appFooter">
        <p>
          <span class="appName">Laforet</span>
          <span class="appDivider">·</span>
          <span class="appVersion">v{__APP_VERSION__}</span>
        </p>
      </footer>
    </div>
  )
}

function App() {
  return (
    <Router root={RootLayout}>
      <Route path="/" component={Home} />
      <Route path="/signup" component={SignUpForm} />
      <Route path="/entry/:id" component={Entry} />
      <Route path="/edit/:id" component={EditEntry} />
      <Route path="/write" component={Write} />
      <Route path="*404" component={NotFound} />
    </Router>
  )
}

export default App
