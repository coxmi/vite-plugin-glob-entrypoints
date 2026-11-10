import { resolve } from 'node:path'

const GLOB_SEGMENTS = /[*?[{(]/

// static directory prefix of a glob, before the first magic segment
function globBase(pattern: string): string {
    const segs = pattern.replace(/^!+/, '').split('/')
    const base: string[] = []
    for (const seg of segs) {
        if (GLOB_SEGMENTS.test(seg)) break
        base.push(seg)
    }
    return base.join('/') || '.'
}

// escape glob metacharacters in a literal path, same set rolldown escapes internally
export function escapeGlob(path: string): string {
    return path.replace(/[\\*?[\]{}!]/g, '\\$&')
}

// directories/files to watch so glob matches can appear or disappear in watch mode
export function watchTargets(globs: string[]): string[] {
    const targets = new Set<string>()
    for (const glob of globs) {
        const pattern = glob.replace(/^!+/, '')
        const target = GLOB_SEGMENTS.test(pattern)
            ? resolve(globBase(pattern))
            : resolve(pattern)
        targets.add(target)
    }
    return [...targets]
}
