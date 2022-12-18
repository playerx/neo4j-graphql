import * as nats from 'nats'
import { StringCodec } from 'nats'
import * as nkeys from 'nkeys.js'

export class AuthJWTPlugin {
  isGlobalAuthenticationEnabled: boolean
  rolesPath: string

  bindPredicate: 'all' | 'any' = 'all'

  private kp: nkeys.KeyPair

  constructor(config: {
    isGlobalAuthenticationEnabled?: boolean
    rolesPath: string
    seed: string
  }) {
    this.rolesPath = config.rolesPath
    this.isGlobalAuthenticationEnabled =
      config.isGlobalAuthenticationEnabled ?? false

    const sc = nats.StringCodec()
    this.kp = nkeys.fromSeed(sc.encode(config.seed))
  }

  /* eslint-disable @typescript-eslint/require-await */
  async decode<T>(token: string): Promise<T | undefined> {
    let result: T | null = null

    try {
      result = jwsVerify<T>(this.kp, token)
    } catch (error) {
      console.error(error)
    }

    return result ?? undefined
  }
  /* eslint-enable @typescript-eslint/require-await */
}

export function jwsVerify<T>(
  kp: nkeys.KeyPair,
  jwt: string
): T | null {
  const sc = StringCodec()

  const jwtParts = jwt.split('.')

  const encodedSignature = fromBase64(jwtParts[2])

  if (!kp.verify(sc.encode(jwtParts[1]), encodedSignature)) {
    return null
  }

  const payloadString = new TextDecoder().decode(
    fromBase64(jwtParts[1])
  )
  const payload = JSON.parse(payloadString)
  if (!payload.jok) {
    return null
  }

  return payload
}

export function fromBase64(x: string): Uint8Array {
  return Uint8Array.from(Buffer.from(fromBase64Decode(x), 'base64'))
}

export function fromBase64Decode(base64: string) {
  return base64.replace(/-/g, '+').replace(/_/g, '/')
}
