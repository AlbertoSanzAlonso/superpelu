import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { Hero } from '@/components/sections/Hero'
import { Services } from '@/components/sections/Services'
import { Studio } from '@/components/sections/Studio'
import { Gallery } from '@/components/sections/Gallery'
import { Contact } from '@/components/sections/Contact'

export default function App() {
  return (
    <>
      <Header />
      <main>
        <Hero />
        <Services />
        <Studio />
        <Gallery />
        <Contact />
      </main>
      <Footer />
    </>
  )
}
