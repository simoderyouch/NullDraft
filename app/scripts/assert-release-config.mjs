const cloudUrl = process.env.NULLDRAFT_CLOUD_API_URL
const requireCloudAccess = process.env.NULLDRAFT_REQUIRE_CLOUD_ACCESS === '1'

// Standard releases are local-first and do not need a cloud deployment. Only
// the invite-only edition has a cloud dependency that must be validated here.
if (requireCloudAccess) {
  if (!cloudUrl) {
    throw new Error('NULLDRAFT_CLOUD_API_URL is required when NULLDRAFT_REQUIRE_CLOUD_ACCESS=1.')
  }

  let parsed
  try {
    parsed = new URL(cloudUrl)
  } catch {
    throw new Error('NULLDRAFT_CLOUD_API_URL must be a valid HTTPS URL.')
  }

  if (parsed.protocol !== 'https:' || parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1') {
    throw new Error('NULLDRAFT_CLOUD_API_URL must be a public HTTPS URL, not localhost.')
  }
}
