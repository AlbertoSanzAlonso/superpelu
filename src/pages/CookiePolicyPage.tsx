import { Link } from 'react-router-dom'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { resolveCookieParagraph } from '@/i18n/helpers'
import { useTranslation } from '@/i18n/useTranslation'
import { typography } from '@/styles/typography'

export function CookiePolicyPage() {
  const { t } = useTranslation()

  return (
    <>
      <Header />
      <main className="bg-cream section-padding !pt-40 md:!pt-44">
        <article className="mx-auto max-w-3xl">
          <header className="mb-12 text-center">
            <p className={`${typography.label} mb-4`}>{t.common.legalInfo}</p>
            <h1 className={typography.h1}>{t.cookiePolicy.title}</h1>
            <p className={`${typography.caption} mt-4`}>
              {t.common.lastUpdated} {t.cookiePolicy.updatedAt}
            </p>
          </header>

          <div className="space-y-10">
            {t.cookiePolicy.sections.map((section) => (
              <section key={section.id} id={section.id} className="scroll-mt-40">
                <h2 className={`${typography.h3} mb-4 text-gold`}>{section.title}</h2>
                {section.paragraphs.map((paragraph, index) => (
                  <p key={index} className={`${typography.body} mb-4 last:mb-0`}>
                    {resolveCookieParagraph(paragraph, section.id)}
                  </p>
                ))}
                {'list' in section &&
                  section.list?.map((item, index) => (
                    <p key={index} className={`${typography.body} mb-4 ml-4 border-l border-gold/30 pl-4`}>
                      {item}
                    </p>
                  ))}
              </section>
            ))}
          </div>

          <p className={`${typography.body} mt-12 text-center`}>
            <Link to="/" className="text-gold transition-colors hover:text-gold-dark">
              {t.common.backHome}
            </Link>
          </p>
        </article>
      </main>
      <Footer />
    </>
  )
}
