import { Route, Router } from "@solidjs/router"
import Home from "./pages/Home"
import Entry from "./pages/Entry"

function App() {

  return (
    <Router>
      <Route path="/" component={Home}/>
      <Route path="/entry/:id" component={Entry}/>
    </Router>
  )
}

export default App
