const js = require('@eslint/js');
const globals = require('globals');
const nx = require('@nx/eslint-plugin');
const tsParser = require('@typescript-eslint/parser');

module.exports = [
    ...nx.configs['flat/base'],
    js.configs.recommended,
    {
        files: ['**/*.ts', '**/*.tsx'],
        languageOptions: {
            parser: tsParser,
            parserOptions: {
                ecmaVersion: 2022,
                sourceType: 'module'
            },
            globals: {
                ...globals.node,
                ...globals.browser
            }
        },
        rules: {
            'no-unused-vars': 'off',
            'no-undef': 'off'
        }
    },
    {
        files: ['**/*.js', '**/*.cjs', '**/*.mjs'],
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'commonjs',
            globals: {
                ...globals.node,
                ...globals.es2022
            }
        },
        rules: {
            'no-unused-vars': ['error', {
                argsIgnorePattern: '^_',
                varsIgnorePattern: '^_',
                caughtErrorsIgnorePattern: '^_'
            }],
            'no-undef': 'error',
            'eqeqeq': 'warn'
        }
    },
    {
        files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
        rules: {
            '@nx/enforce-module-boundaries': ['error', {
                depConstraints: [
                    { sourceTag: 'layer:domain', onlyDependOnLibsWithTags: ['layer:domain', 'layer:platform', 'layer:shared'] },
                    { sourceTag: 'layer:app', onlyDependOnLibsWithTags: ['layer:domain', 'layer:app', 'layer:infra', 'layer:shared', 'layer:platform'] },
                    { sourceTag: 'layer:infra', onlyDependOnLibsWithTags: ['layer:infra', 'layer:shared', 'layer:platform'] },
                    { sourceTag: 'layer:agent', onlyDependOnLibsWithTags: ['layer:agent', 'layer:app', 'layer:domain', 'layer:shared', 'layer:platform'] },
                    { sourceTag: 'layer:ui', onlyDependOnLibsWithTags: ['layer:ui', 'layer:shared', 'layer:release'] },
                    // 基座不得反向依赖业务域或前端渲染层（openspec: app-workspace-topology）
                    { sourceTag: 'layer:platform', notDependOnLibsWithTags: ['layer:domain', 'layer:ui', 'layer:agent'] },
                    { sourceTag: 'scope:agent-kernel', notDependOnLibsWithTags: ['layer:app', 'layer:infra'] },
                    { sourceTag: 'type:app', onlyDependOnLibsWithTags: ['layer:domain', 'layer:app', 'layer:infra', 'layer:shared', 'layer:agent', 'layer:release', 'layer:ui', 'layer:platform'] },
                    { sourceTag: 'runtime:browser', notDependOnLibsWithTags: ['runtime:node'] }
                ]
            }]
        }
    }
];
