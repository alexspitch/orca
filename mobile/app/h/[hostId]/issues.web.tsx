import { MobileBuildWebScreen } from '../../../src/build-web/MobileBuildWebScreen'

// Render screen directly: native sibling imports a shell module that throws in browsers, and manifest imports every route.
export default function MobileIssuesRoute() {
  return <MobileBuildWebScreen />
}
