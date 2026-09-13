import { Routes, Route } from 'react-router-dom'
import { NavBar, Footer } from './components/Brand.jsx'
import Home from './pages/Home.jsx'
import Analyze from './pages/Analyze.jsx'
import Explorer from './pages/Explorer.jsx'
import About from './pages/About.jsx'
import UserNetwork from './pages/UserNetwork.jsx'   // user-network add-on (revertible)
import PollutantMap from './pages/PollutantMap.jsx'  // pollutant-map add-on (revertible)
import Reviews from './pages/Reviews.jsx'  // reviews page (local only for now)
import { SHOW_EXPOSURE_RISK } from './features.js'

export default function App() {
  return (
    <Routes>
      <Route path="/explorer" element={<Explorer />} />
      <Route
        path="*"
        element={
          <>
            <NavBar />
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/analyze" element={<Analyze />} />
              <Route path="/your-data" element={<UserNetwork />} />{/* user-network add-on (revertible) */}
              {SHOW_EXPOSURE_RISK && <Route path="/air" element={<PollutantMap />} />}{/* pollutant-map add-on (revertible) */}
              <Route path="/about" element={<About />} />
              <Route path="/reviews" element={<Reviews />} />{/* reviews page (local only for now) */}
            </Routes>
            <Footer />
          </>
        }
      />
    </Routes>
  )
}
