// maplibre's worker script, set once by main.tsx (vite bundles it as ?worker&url). the map chunk reads it before
// building its first map; kept here so main.tsx does not have to import maplibre itself
let workerUrl: string | null = null

export function setMapWorkerUrl(url: string) {
  workerUrl = url
}

export function mapWorkerUrl(): string | null {
  return workerUrl
}
