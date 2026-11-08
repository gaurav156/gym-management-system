import { branding, useAssetsStatus } from '../utils/branding'

export default function HeroEmblem() {
  const urls = branding.heroOuterUrl && branding.heroInnerUrl
    ? [branding.heroOuterUrl, branding.heroInnerUrl] : []
  const status = useAssetsStatus(urls)

  if (status === 'loading') return null   // decorative: no flash of the fallback first

  return (
    <div aria-hidden="true"
      className="pointer-events-none absolute -right-24 top-1/2 hidden -translate-y-1/2 sm:block">
      {status === 'ok' ? (
        <div className="relative h-[420px] w-[420px]">
          <img src={branding.heroOuterUrl} alt="" className="animate-slow-spin h-full w-full" />
          <img src={branding.heroInnerUrl} alt=""
            className="absolute left-1/2 top-1/2 h-[65.5%] w-[65.5%] -translate-x-1/2 -translate-y-1/2" />
        </div>
      ) : (
        <>
          <div className="animate-slow-spin h-[420px] w-[420px] rounded-full border-[18px] border-white/[0.06]" />
          <div className="absolute inset-16 rounded-full border-[14px] border-brand/20" />
          <div className="absolute inset-32 rounded-full border-[10px] border-white/[0.08]" />
        </>
      )}
    </div>
  )
}