// leaving the app for the provider's consent page. its own module so a test can stub it: jsdom's
// window.location cannot be redefined
export function redirectTo(url: string): void {
  window.location.assign(url)
}
