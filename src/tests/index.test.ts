import { equal, ifError, match, ok } from 'node:assert/strict';
import { dirname, join, relative } from 'node:path';
import { afterEach, describe, it } from 'node:test';
// eslint-disable-next-line import/no-named-as-default
import webpack, { type Compiler } from 'webpack';
import { load } from 'cheerio';
import HtmlWebpackPlugin from 'html-webpack-plugin';
import { fs, vol } from 'memfs';
import { HwpInlineRuntimeChunkPlugin } from '../index';

const hwpOptions: HtmlWebpackPlugin.Options = {
    filename: 'index.html',
    hash: false,
    minify: {
        collapseWhitespace: true,
        removeRedundantAttributes: true,
    },
    showErrors: true,
    template: join(__dirname, './data/index.html'),
};

const webpackConfig: webpack.Configuration = {
    mode: 'development',
    entry: {
        script1: join(__dirname, './data/script1.js'),
        script2: join(__dirname, './data/script2.js'),
        polyfills: join(__dirname, './data/polyfills.js'),
    },
    output: {
        path: '/build',
    },
};

const filesystem = {
    join,
    mkdir: fs.mkdir.bind(fs),
    rmdir: fs.rmdir.bind(fs),
    unlink: fs.unlink.bind(fs),
    writeFile: fs.writeFile.bind(fs),
    stat: fs.stat.bind(fs),
    readFile: fs.readFile.bind(fs),
    relative,
    dirname,
} as Compiler['outputFileSystem'];

function getOutput(): string {
    const htmlFile = '/build/index.html';
    const htmlContents = fs.readFileSync(htmlFile).toString('utf8');
    return htmlContents;
}

afterEach((): void => vol.reset());

void describe('HwpInlineRuntimeChunkPlugin', (): void => {
    void it('should do nothing when runtimeChunk is not set', (_, done): void => {
        const compiler = webpack({
            ...webpackConfig,
            plugins: [new HtmlWebpackPlugin(hwpOptions), new HwpInlineRuntimeChunkPlugin()],
        });

        compiler.outputFileSystem = filesystem;
        compiler.run((err): void => {
            try {
                ifError(err);
                const html = getOutput();
                const $ = load(html);
                const inlineScripts = $('script:not([src])');
                equal(inlineScripts.get().length, 0);

                setImmediate(done);
            } catch (e) {
                setImmediate(done, e);
            }
        });
    });

    void it('it should inline one chunk when runtimeChunk=single', (_, done): void => {
        const compiler = webpack({
            ...webpackConfig,
            optimization: {
                runtimeChunk: 'single',
            },
            plugins: [new HtmlWebpackPlugin(hwpOptions), new HwpInlineRuntimeChunkPlugin()],
        });

        compiler.outputFileSystem = filesystem;
        compiler.run((err): void => {
            try {
                ifError(err);
                const html = getOutput();
                const $ = load(html);
                const inlineScripts = $('script:not([src])');
                equal(inlineScripts.get().length, 1);

                const script = inlineScripts.html();
                equal(typeof script, 'string');
                equal(script!.includes('__webpack_require__'), true);

                setImmediate(done);
            } catch (e) {
                setImmediate(done, e);
            }
        });
    });

    void it('it should inline one runtime chunk per entry when runtimeChunk=multiple', (_, done): void => {
        const compiler = webpack({
            ...webpackConfig,
            optimization: {
                runtimeChunk: 'multiple',
            },
            plugins: [new HtmlWebpackPlugin(hwpOptions), new HwpInlineRuntimeChunkPlugin()],
        });

        compiler.outputFileSystem = filesystem;
        compiler.run((err): void => {
            try {
                ifError(err);
                const html = getOutput();
                const $ = load(html);
                const inlineScripts = $('script:not([src])');
                equal(inlineScripts.get().length, 3);

                inlineScripts.each((index, element) => {
                    const script = $(element).html();
                    equal(typeof script, 'string');
                    equal(script!.includes('__webpack_require__'), true);
                });

                setImmediate(done);
            } catch (e) {
                setImmediate(done, e);
            }
        });
    });

    void it('should not strip source maps by default', (_, done): void => {
        const compiler = webpack({
            ...webpackConfig,
            devtool: 'source-map',
            optimization: {
                runtimeChunk: 'single',
            },
            plugins: [new HtmlWebpackPlugin(hwpOptions), new HwpInlineRuntimeChunkPlugin()],
        });

        compiler.outputFileSystem = filesystem;
        compiler.run((err): void => {
            try {
                ifError(err);
                const html = getOutput();
                const $ = load(html);
                const inlineScripts = $('script:not([src])');
                equal(inlineScripts.get().length, 1);

                const script = inlineScripts.html();
                equal(typeof script, 'string');
                match(script!, /\/\/# sourceMappingURL=runtime\.js\.map$/u);

                setImmediate(done);
            } catch (e) {
                setImmediate(done, e);
            }
        });
    });

    for (const type of [
        'eval',
        'inline-source-map',
        'hidden-source-map',
        'eval-source-map',
        'inline-nosources-source-map',
        'hidden-nosources-source-map',
        'eval-nosources-source-map',
        'inline-cheap-source-map',
        'hidden-cheap-source-map',
        'eval-cheap-source-map',
        'inline-nosources-cheap-source-map',
        'hidden-nosources-cheap-source-map',
        'eval-nosources-cheap-source-map',
        'inline-cheap-module-source-map',
        'hidden-cheap-module-source-map',
        'eval-cheap-module-source-map',
        'inline-nosources-cheap-module-source-map',
        'hidden-nosources-cheap-module-source-map',
        'eval-nosources-cheap-module-source-map',
    ]) {
        void it(`should strip source maps when asked to (devtool=${type})`, (_, done) => {
            const compiler = webpack({
                ...webpackConfig,
                devtool: type,
                optimization: {
                    runtimeChunk: 'single',
                },
                plugins: [
                    new HtmlWebpackPlugin(hwpOptions),
                    new HwpInlineRuntimeChunkPlugin({ removeSourceMap: true }),
                ],
            });

            compiler.outputFileSystem = filesystem;
            compiler.run((err): void => {
                try {
                    ifError(err);
                    const html = getOutput();
                    const $ = load(html);
                    const inlineScripts = $('script:not([src])');
                    equal(inlineScripts.get().length, 1);

                    const script = inlineScripts.html();
                    equal(typeof script, 'string');
                    equal(script!.includes('//# sourceMappingURL='), false);

                    setImmediate(done);
                } catch (e) {
                    setImmediate(done, e);
                }
            });
        });
    }

    for (const publicPath of ['/test', '/test/', '']) {
        void it(`should append trailing slash to output path if necessary (publicPath=${publicPath})`, (_, done): void => {
            const compiler = webpack({
                ...webpackConfig,
                output: {
                    path: '/build',
                    publicPath,
                },
                optimization: {
                    runtimeChunk: 'single',
                },
                plugins: [new HtmlWebpackPlugin(hwpOptions), new HwpInlineRuntimeChunkPlugin()],
            });

            compiler.outputFileSystem = filesystem;
            compiler.run((err): void => {
                try {
                    ifError(err);
                    const html = getOutput();
                    const $ = load(html);
                    const inlineScripts = $('script:not([src])');
                    equal(inlineScripts.get().length, 1);

                    const script = inlineScripts.html();
                    equal(typeof script, 'string');
                    equal(script!.includes('__webpack_require__'), true);

                    setImmediate(done);
                } catch (e) {
                    setImmediate(done, e);
                }
            });
        });
    }

    void it('should handle the case when output is not set', (_, done): void => {
        const compiler = webpack({
            ...webpackConfig,
            output: undefined,
            optimization: {
                runtimeChunk: 'single',
            },
            plugins: [new HtmlWebpackPlugin(hwpOptions), new HwpInlineRuntimeChunkPlugin()],
        });

        compiler.outputFileSystem = filesystem;
        compiler.run((err): void => {
            try {
                ifError(err);
                const files = vol.toJSON();
                const keys = Object.keys(files).filter((name) => name.endsWith('.html'));

                equal(keys.length, 1);
                ok(keys[0]);

                const html = files[keys[0]]!;
                const $ = load(html);
                const inlineScripts = $('script:not([src])');
                equal(inlineScripts.get().length, 1);

                const script = inlineScripts.html();
                equal(typeof script, 'string');
                equal(script!.includes('__webpack_require__'), true);

                setImmediate(done);
            } catch (e) {
                setImmediate(done, e);
            }
        });
    });

    void it('should do no harm when instantiated twice', (_, done): void => {
        const compiler = webpack({
            ...webpackConfig,
            optimization: {
                runtimeChunk: 'single',
            },
            plugins: [
                new HtmlWebpackPlugin(hwpOptions),
                new HwpInlineRuntimeChunkPlugin(),
                new HwpInlineRuntimeChunkPlugin(),
            ],
        });

        compiler.outputFileSystem = filesystem;
        compiler.run((err): void => {
            try {
                ifError(err);
                const html = getOutput();
                const $ = load(html);
                const inlineScripts = $('script:not([src])');
                equal(inlineScripts.get().length, 1);

                const script = inlineScripts.html();
                equal(typeof script, 'string');
                equal(script!.includes('__webpack_require__'), true);

                setImmediate(done);
            } catch (e) {
                setImmediate(done, e);
            }
        });
    });
});
