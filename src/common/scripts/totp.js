const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"

// RFC-compatible Base32 test secret used only as an out-of-the-box display example.
export const MFA_ACCOUNTS = [
  {
    id: "bandotp-demo",
    issuer: "BandOTP",
    accountName: "示例验证码",
    category: "默认分类",
    secret: "JBSWY3DPEHPK3PXP",
    digits: 6,
    period: 30
  }
]

export function getAccountById(id) {
  for (let index = 0; index < MFA_ACCOUNTS.length; index++) {
    if (MFA_ACCOUNTS[index].id === id) {
      return MFA_ACCOUNTS[index]
    }
  }
  return null
}

export function buildTokenState(account, now) {
  const timestamp = now || Date.now()
  const period = account.period || 30
  const digits = account.digits || 6
  const code = generateTotp(account.secret, timestamp, period, digits)
  const epochSeconds = Math.floor(timestamp / 1000)
  const remaining = period - (epochSeconds % period)

  return {
    id: account.id,
    issuer: account.issuer,
    accountName: account.accountName,
    code,
    groupedCode: groupCode(code),
    remaining,
    period,
    digits,
    progress: Math.floor((remaining * 100) / period),
    status: remaining <= 5 ? "即将刷新" : "可用"
  }
}

export function generateTotp(secret, timestamp, period, digits) {
  const counter = Math.floor(Math.floor(timestamp / 1000) / period)
  const keyBytes = decodeBase32(secret)
  const counterBytesValue = counterBytes(counter)
  const digest = hmacSha1(keyBytes, counterBytesValue)
  const offset = digest[digest.length - 1] & 0x0f
  const binary =
    ((digest[offset] & 0x7f) << 24) |
    ((digest[offset + 1] & 0xff) << 16) |
    ((digest[offset + 2] & 0xff) << 8) |
    (digest[offset + 3] & 0xff)
  const otp = binary % Math.pow(10, digits)
  return padLeft(String(otp), digits)
}

function groupCode(code) {
  if (code.length <= 4) {
    return code
  }
  return `${code.slice(0, 3)} ${code.slice(3)}`
}

function decodeBase32(value) {
  const cleanValue = value.toUpperCase().replace(/[\s=-]/g, "")
  const bytes = []
  let bits = 0
  let bitLength = 0

  for (let index = 0; index < cleanValue.length; index++) {
    const alphabetIndex = BASE32_ALPHABET.indexOf(cleanValue[index])
    if (alphabetIndex < 0) {
      continue
    }
    bits = (bits << 5) | alphabetIndex
    bitLength += 5
    if (bitLength >= 8) {
      bytes.push((bits >> (bitLength - 8)) & 0xff)
      bitLength -= 8
    }
  }

  return bytes
}

function counterBytes(counter) {
  const high = Math.floor(counter / 0x100000000)
  const low = counter >>> 0
  return [
    (high >>> 24) & 0xff,
    (high >>> 16) & 0xff,
    (high >>> 8) & 0xff,
    high & 0xff,
    (low >>> 24) & 0xff,
    (low >>> 16) & 0xff,
    (low >>> 8) & 0xff,
    low & 0xff
  ]
}

function hmacSha1(keyBytes, messageBytes) {
  let normalizedKey = keyBytes.slice()
  if (normalizedKey.length > 64) {
    normalizedKey = sha1(normalizedKey)
  }

  while (normalizedKey.length < 64) {
    normalizedKey.push(0)
  }

  const outerPad = []
  const innerPad = []
  for (let index = 0; index < 64; index++) {
    outerPad[index] = normalizedKey[index] ^ 0x5c
    innerPad[index] = normalizedKey[index] ^ 0x36
  }

  return sha1(outerPad.concat(sha1(innerPad.concat(messageBytes))))
}

function sha1(messageBytes) {
  const bytes = messageBytes.slice()
  const originalBitLength = bytes.length * 8
  bytes.push(0x80)

  while (bytes.length % 64 !== 56) {
    bytes.push(0)
  }

  for (let shift = 56; shift >= 0; shift -= 8) {
    bytes.push(Math.floor(originalBitLength / Math.pow(2, shift)) & 0xff)
  }

  let h0 = 0x67452301
  let h1 = 0xefcdab89
  let h2 = 0x98badcfe
  let h3 = 0x10325476
  let h4 = 0xc3d2e1f0

  for (let chunk = 0; chunk < bytes.length; chunk += 64) {
    const words = new Array(80)
    for (let index = 0; index < 16; index++) {
      const offset = chunk + index * 4
      words[index] =
        (bytes[offset] << 24) |
        (bytes[offset + 1] << 16) |
        (bytes[offset + 2] << 8) |
        bytes[offset + 3]
    }

    for (let index = 16; index < 80; index++) {
      words[index] = rotateLeft(
        words[index - 3] ^ words[index - 8] ^ words[index - 14] ^ words[index - 16],
        1
      )
    }

    let a = h0
    let b = h1
    let c = h2
    let d = h3
    let e = h4

    for (let index = 0; index < 80; index++) {
      let f
      let k
      if (index < 20) {
        f = (b & c) | (~b & d)
        k = 0x5a827999
      } else if (index < 40) {
        f = b ^ c ^ d
        k = 0x6ed9eba1
      } else if (index < 60) {
        f = (b & c) | (b & d) | (c & d)
        k = 0x8f1bbcdc
      } else {
        f = b ^ c ^ d
        k = 0xca62c1d6
      }

      const temp = (rotateLeft(a, 5) + f + e + k + words[index]) | 0
      e = d
      d = c
      c = rotateLeft(b, 30)
      b = a
      a = temp
    }

    h0 = (h0 + a) | 0
    h1 = (h1 + b) | 0
    h2 = (h2 + c) | 0
    h3 = (h3 + d) | 0
    h4 = (h4 + e) | 0
  }

  return wordsToBytes([h0, h1, h2, h3, h4])
}

function rotateLeft(value, bits) {
  return (value << bits) | (value >>> (32 - bits))
}

function wordsToBytes(words) {
  const bytes = []
  words.forEach(word => {
    bytes.push((word >>> 24) & 0xff)
    bytes.push((word >>> 16) & 0xff)
    bytes.push((word >>> 8) & 0xff)
    bytes.push(word & 0xff)
  })
  return bytes
}

function padLeft(value, length) {
  let result = value
  while (result.length < length) {
    result = `0${result}`
  }
  return result
}
