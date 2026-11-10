import { test } from 'node:test'
import assert from 'node:assert/strict'
import { cpSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { spawn } from 'node:child_process'

const rm = path => rmSync(path, { force: true, recursive: true })
const cp = (src, dst) => cpSync(src, dst, { force: true, recursive: true })
const mkdir = path => mkdirSync(path, { force: true, recursive: true })


function watch(cwd) {
    let log = ''
    const addToLog = string => log += string

    // create process and add output to log
    const child = spawn('vite build --watch', { cwd, shell: true })
    child.stdout.on('data', addToLog)
    child.stderr.on('data', addToLog)
    // captured at spawn so stop never waits on an exit that already happened
    const exited = new Promise(r => child.once('exit', r))

    // wait for the next build to finish
    async function waitForBuild() {
        const done = buildCount()
        const deadline = Date.now() + 2000
        while (buildCount() === done) {
            if (Date.now() > deadline) assert.fail(`timed out waiting for rebuild:\n${log}`)
            await new Promise(r => setTimeout(r, 300))
        }
        assert.ok(!/error/i.test(log), `build errored:\n${log}`)
    }

    // trigger fn, wait for the rebuild it causes, assert the module count it produced
    async function assertBuild(fn, expected) {
        fn()
        await waitForBuild()
        assert.equal(moduleCount(), expected, `unexpected module count:\n${log}`)
    }

    async function stop() {
        child.kill('SIGKILL')
        await exited
    }

    function buildCount() {
        return (log.match(/built in/g) ?? []).length
    }

    function moduleCount() {
        return parseInt(log.match(/\d+ modules transformed/g)?.at(-1))
    }

    return { moduleCount, waitForBuild, assertBuild, stop }
}


test('entrypoints react to glob changes in watch mode', async t => {

    // link the plugin into node_modules so the fixture config can import it by name
    const link = join('node_modules', 'vite-plugin-glob-entrypoints')
    rm(link)
    symlinkSync(process.cwd(), link)

    // copy the fixture into the .fixtures dir
    const source = join('fixtures', 'watch')
    const working = join('.fixtures', 'watch')
    rm(working)
    cp(source, working)

    // setup initial files
    const modifiedDir = join(working, 'src/modified')
    const modifiedFile = join(working, 'src/modified/scratch.tsx')
    const deletedDir = join(working, 'src/deleted')
    const deletedFile = join(working, 'src/deleted/scratch.tsx')
    mkdir(modifiedDir)
    mkdir(deletedDir)
    writeFileSync(modifiedFile, 'export const a = 1\n')
    writeFileSync(deletedFile, 'export const b = 1\n')

    // tidy up after test
    const w = watch(working)
    t.after(async () => {
        await w.stop()
        rm('.fixtures')
        rm(link)
    })

    await w.waitForBuild()
    const initial = w.moduleCount()

    // modify an initially-matched file
    await w.assertBuild(() => {
        writeFileSync(modifiedFile, 'export const a = 2\n')
    }, initial)

    // create a new file that matches a glob input
    await w.assertBuild(() => {
        const dir = join(working, 'src/created')
        const file = join(working, 'src/created/scratch.tsx')
        mkdir(dir)
        writeFileSync(file, 'export const c = 1\n')
    }, initial + 1)

    // delete a matched file
    await w.assertBuild(() => {
        rm(deletedFile)
    }, initial)
})
