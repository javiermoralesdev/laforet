import { Route, Router } from "@solidjs/router"
import Home from "./pages/Home"
import NotFound from "./pages/NotFround"
import Write from "./pages/Write"
import './App.scss'
import Entry from "./pages/Entry"
import EditEntry from "./pages/EditEntry"

function App() {

  return (
    <Router>
      <Route path="/" component={Home} />
      <Route path="/entry/:id" component={Entry} />
      <Route path="/edit/:id" component={EditEntry} />
      <Route path="/write" component={Write} />
      <Route path="*404" component={NotFound} />
    </Router>
  )
}

export default App
