export default {
  extends: ['@commitlint/config-conventional'],
  // Ignore dependency-bump commits (e.g. from Dependabot/Renovate).
  ignores: [(message) => message.startsWith('chore: bump') || message.startsWith('Updating')],
};
