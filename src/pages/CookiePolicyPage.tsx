import { Link } from 'react-router-dom'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { cookiePolicyMeta, cookiePolicySections } from '@/data/cookiePolicy'
import { typography } from '@/styles/typography'

export function CookiePolicyPage() {
  return (
    <>
      <Header />
      <main className="bg-cream section-padding !pt-40 md:!pt-44">
        <article className="mx-auto max-w-3xl">
          <header className="mb-12 text-center">
            <p className={`${typography.label} mb-4`}>Información legal</p>
            <h1 className={typography.h1}>{cookiePolicyMeta.title}</h1>
            <p className={`${typography.caption} mt-4`}>
              Última actualización: {cookiePolicyMeta.updatedAt}
            </p>
          </header>

          <div className="space-y-10">
            {cookiePolicySections.map((section) => (
              <section key={section.id} id={section.id} className="scroll-mt-40">
                <h2 className={`${typography.h3} mb-4 text-gold`}>{section.title}</h2>
                {section.paragraphs.map((paragraph) => (
                  <p key={paragraph} className={`${typography.body} mb-4 last:mb-0`}>
                    {paragraph}
                  </p>
                ))}
                {'list' in section &&
                  section.list?.map((item) => (
                    <p key={item} className={`${typography.body} mb-4 ml-4 border-l border-gold/30 pl-4`}>
                      {item}
                    </p>
                  ))}
              </section>
            ))}
          </div>

          <p className={`${typography.body} mt-12 text-center`}>
            <Link to="/" className="text-gold transition-colors hover:text-gold-dark">
              Volver al inicio
            </Link>
          </p>
        </article>
      </main>
      <Footer />
    </>
  )
}
