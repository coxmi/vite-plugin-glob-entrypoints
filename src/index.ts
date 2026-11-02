import { globSync } from 'node:fs'
import { resolve } from 'node:path'
import { type Plugin } from 'vite'


export default function entrypoints(record: Record<string, string | string[]>): Plugin {

    // we don't want the prefix appearing in the manifest, so for some level of uniqueness,
    // we just use the null byte repeated, in a relatively unique way
    const PREFIX = '\0'.repeat('entrypoints'.length)
    const entrypoints = new Set<string>();

    // normalize record input
    const normalized: Record<string, string[]> = {}
    for (const name in record) 
        normalized[name] = [record[name]].flat()

    function filelist(globs: string[]): string[] {
        const list = globs.flatMap(path => globSync(path))
        return [...new Set(list)]
    }

    return {
        name: 'entrypoints',
        enforce: 'pre',

        // add prefixed entrypoints to the config as { name: `{prefix}{name}` }
        config() {
            const input: Record<string, string> = {}
            for (const name in record) {
                const id = `${PREFIX}${name}`
                input[name] = id
                entrypoints.add(id)
            }
            return {
                build: {
                    rolldownOptions: { input }
                }
            }
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

        // for basic watch mode, just add all currently matching files
        buildStart() {
            if (this.meta.watchMode) {
                for (const patterns of Object.values(normalized)) {
                    for (const file of filelist(patterns)) {
                        this.addWatchFile(resolve(file))
                    }
                }
            }
        },
    }
}
