// conventional commits. release-please reads them to pick the next version.
export default {
  extends: ['@commitlint/config-conventional'],
  // dependabot bodies paste release notes with long lines; its header is already conventional
  ignores: [(message) => /^(chore|ci)\(deps(-dev)?\): bump /.test(message)],
  rules: {
    // the imported history uses long, sentence-like subjects
    'header-max-length': [2, 'always', 120],
    'subject-case': [0]
  }
}
