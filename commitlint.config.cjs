module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'scope-enum': [
      1,
      'always',
      [
        'backend',
        'frontend',
        'auth',
        'db',
        'core',
        'security',
        'rbac',
        'admin',
        'sessions',
        'users',
        'ci',
        'deps',
      ],
    ],
    'subject-case': [0],
    'header-max-length': [2, 'always', 100],
  },
};
