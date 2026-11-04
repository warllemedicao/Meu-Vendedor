export async function encryptionKey(encoded: string): Promise<CryptoKey> {
  const bytes = Uint8Array.from(atob(encoded), c => c.charCodeAt(0));
  if (bytes.length !== 32) throw new Error("invalid_encryption_configuration");
  return crypto.subtle.importKey("raw", bytes, "AES-GCM", false, ["encrypt","decrypt"]);
}
export async function encryptCredentials(value: unknown, key: CryptoKey, userId: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = await crypto.subtle.encrypt({name:"AES-GCM",iv,additionalData:new TextEncoder().encode(`mv:shopee:${userId}:v1`)},key,new TextEncoder().encode(JSON.stringify(value)));
  const encode = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));
  return `v1.${encode(iv)}.${encode(new Uint8Array(cipher))}`;
}
export async function decryptCredentials(value: string, key: CryptoKey, userId: string): Promise<unknown> {
  const [version,iv,cipher] = value.split(".");
  if(version!=="v1" || !iv || !cipher)throw new Error("invalid_ciphertext");
  const decode = (text:string) => Uint8Array.from(atob(text), c=>c.charCodeAt(0));
  const plain = await crypto.subtle.decrypt({name:"AES-GCM",iv:decode(iv),additionalData:new TextEncoder().encode(`mv:shopee:${userId}:v1`)},key,decode(cipher));
  return JSON.parse(new TextDecoder().decode(plain));
}
export async function secretMatches(input: string | null, expected: string): Promise<boolean> {
  if (!input || !expected) return false;
  const digest = async(value:string) => new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(value)));
  const [a,b]=await Promise.all([digest(input),digest(expected)]);let diff=0;
  for(let i=0;i<a.length;i++)diff|=a[i]^b[i];
  return diff===0;
}
