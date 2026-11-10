import { globSync } from 'node:fs'
import { resolve, sep } from 'node:path'
import { type Plugin, type UserConfig } from 'vite'
import { escapeGlob, watchTargets } from './glob.js'

export function filelist(globs: string[]): string[] {
    const list = globs.flatMap(path => globSync(path))
    return [...new Set(list)]
}

export default function entrypoints(record: Record<string, string | string[]>): Plugin {

    // we don't want the prefix appearing in the manifest, so for some level of uniqueness,
    // we just use the null byte repeated, in a relatively unique way
    const PREFIX = '\0'.repeat('entrypoints'.length)
    const entrypoints = new Set<string>();

    // keep the watcher out of node_modules and .git
    const WATCH_EXCLUDES = ['**/node_modules/**', '**/.git/**']

    // normalize record input
    const normalized: Record<string, string[]> = {}
    for (const name in record) 
        normalized[name] = [record[name]].flat()

    return {
        name: 'entrypoints',
        enforce: 'pre',
        
        config(config): UserConfig {
            // add prefixed entrypoints to the config as { name: `{prefix}{name}` }
            const input: Record<string, string> = {}
            for (const name in record) {
                const id = `${PREFIX}${name}`
                input[name] = id
                entrypoints.add(id)
            }

            const result: UserConfig = {
                build: { 
                    rolldownOptions: { input },
                },
            }

            // add output dir + excludes to watch options
            const root = config.root ?? process.cwd()
            const outputDir = resolve(root, config.build?.outDir ?? 'dist')
            const outputDirNormalized = outputDir.split(sep).join('/')
            if (config.build?.watch) {
                result.build!.watch = {
                    exclude: [
                        ...WATCH_EXCLUDES, 
                        `${escapeGlob(outputDirNormalized)}/**`
                    ]
                }
            }
            return result
        },

        // resolve entrypoints to a virtual
        // it already starts with a \0 (from the prefix), so can work as a virtual id
        resolveId(id) {
            if (!entrypoints.has(id)) return
            return id
        },

        // construct the main entrypoint file
        load(id) {
            if (!id.startsWith(PREFIX)) return
            const name = id.slice(PREFIX.length)
            const globs: string[] = normalized[name] || []
            if (this.meta.watchMode) {
                // watch glob bases so new/deleted matches invalidate this module
                // adding files here attributes them to this module
                for (const target of watchTargets(globs)) this.addWatchFile(target)
            }
            const files = filelist(globs)
            const code = files.map(file => 
                `import ${JSON.stringify(resolve(file))}`
            ).join('\n')
            return code
        },

        // watch globs in dev/serve modes
        configureServer(server) {
            const watcher = server.watcher
            for (const patterns of Object.values(normalized)) {
                for (const pattern of patterns) {
                    watcher.add(pattern)
                }
            }
        },
    }
}
