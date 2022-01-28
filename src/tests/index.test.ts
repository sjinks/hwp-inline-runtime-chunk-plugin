import path from 'path';
import webpack from 'webpack';
import cheerio from 'cheerio';
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
    template: path.join(__dirname, './data/index.html'),
};

const webpackConfig: webpack.Configuration = {
    mode: 'development',
    entry: {
        script1: path.join(__dirname, './data/script1.js'),
        script2: path.join(__dirname, './data/script2.js'),
        polyfills: path.join(__dirname, './data/polyfills.js'),
    },
    output: {
        path: '/build',
    },
};

const filesystem = {
    join: path.join,
    mkdir: fs.mkdir,
    mkdirp: fs.mkdirp,
    rmdir: fs.rmdir,
    unlink: fs.unlink,
    writeFile: fs.writeFile,
    stat: fs.stat,
    readFile: fs.readFile,
    relative: path.relative,
    dirname: path.dirname,
};

function getOutput(): string {
    const htmlFile = '/build/index.html';
    const htmlContents = fs.readFileSync(htmlFile).toString('utf8');
    return htmlContents;
}

afterEach((): void => vol.reset());

describe('HwpInlineRuntimeChunkPlugin', (): void => {
    it('should do nothing when runtimeChunk is not set', (done): void => {
        const compiler = webpack({
            ...webpackConfig,
            plugins: [new HtmlWebpackPlugin(hwpOptions), new HwpInlineRuntimeChunkPlugin()],
        });

        compiler.outputFileSystem = filesystem;
        compiler.run((err): void => {
            try {
                expect(err).toBeFalsy();
                const html = getOutput();
                const $ = cheerio.load(html);
                const inlineScripts = $('script:not([src])');
                expect(inlineScripts.get()).toHaveLength(0);

                setImmediate(done);
            } catch (e) {
                setImmediate(done, e);
            }
        });
    });

    it('it should inline one chunk when runtimeChunk=single', (done): void => {
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
                expect(err).toBeFalsy();
                const html = getOutput();
                const $ = cheerio.load(html);
                const inlineScripts = $('script:not([src])');
                expect(inlineScripts.get()).toHaveLength(1);

                const script = inlineScripts.html();
                expect(script).toContain('__webpack_require__');

                setImmediate(done);
            } catch (e) {
                setImmediate(done, e);
            }
        });
    });

    it('it should inline one runtime chunk per entry when runtimeChunk=multiple', (done): void => {
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
                expect(err).toBeFalsy();
                const html = getOutput();
                const $ = cheerio.load(html);
                const inlineScripts = $('script:not([src])');
                expect(inlineScripts.get()).toHaveLength(3);

                inlineScripts.each((index, element) => {
                    expect($(element).html()).toContain('__webpack_require__');
                });

                setImmediate(done);
            } catch (e) {
                setImmediate(done, e);
            }
        });
    });

    it('should not strip source maps by default', (done): void => {
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
                expect(err).toBeFalsy();
                const html = getOutput();
                const $ = cheerio.load(html);
                const inlineScripts = $('script:not([src])');
                expect(inlineScripts.get()).toHaveLength(1);

                const script = inlineScripts.html();
                expect(script).toMatch(/\/\/# sourceMappingURL=runtime\.js\.map$/);

                setImmediate(done);
            } catch (e) {
                setImmediate(done, e);
            }
        });
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    it.each<any>([
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
    ])('should strip source maps when asked to (devtool=%s)', (type: string, done: jest.DoneCallback) => {
        const compiler = webpack({
            ...webpackConfig,
            devtool: type,
            optimization: {
                runtimeChunk: 'single',
            },
            plugins: [new HtmlWebpackPlugin(hwpOptions), new HwpInlineRuntimeChunkPlugin({ removeSourceMap: true })],
        });

        compiler.outputFileSystem = filesystem;
        compiler.run((err): void => {
            try {
                expect(err).toBeFalsy();
                const html = getOutput();
                const $ = cheerio.load(html);
                const inlineScripts = $('script:not([src])');
                expect(inlineScripts.get()).toHaveLength(1);

                const script = inlineScripts.html();
                expect(script).not.toContain('//# sourceMappingURL=');

                setImmediate(done);
            } catch (e) {
                setImmediate(done, e);
            }
        });
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    it.each<any>(['/test', '/test/', ''])(
        'should append trailing slash to output path if necessary (publicPath=%s)',
        (publicPath: string, done): void => {
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
                    expect(err).toBeFalsy();
                    const html = getOutput();
                    const $ = cheerio.load(html);
                    const inlineScripts = $('script:not([src])');
                    expect(inlineScripts.get()).toHaveLength(1);

                    const script = inlineScripts.html();
                    expect(script).toContain('__webpack_require__');

                    setImmediate(done);
                } catch (e) {
                    setImmediate(done, e);
                }
            });
        },
    );

    it('should handle the case when output is not set', (done): void => {
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
                expect(err).toBeFalsy();
                const files = vol.toJSON();
                const keys = Object.keys(files).filter((name) => name.endsWith('.html'));

                expect(keys).toHaveLength(1);
                expect(keys[0]).toBeTruthy();

                const html = files[keys[0]] as string;
                const $ = cheerio.load(html);
                const inlineScripts = $('script:not([src])');
                expect(inlineScripts.get()).toHaveLength(1);

                const script = inlineScripts.html();
                expect(script).toContain('__webpack_require__');

                setImmediate(done);
            } catch (e) {
                setImmediate(done, e);
            }
        });
    });

    it('should do no harm when instantiated twice', (done): void => {
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
                expect(err).toBeFalsy();
                const html = getOutput();
                const $ = cheerio.load(html);
                const inlineScripts = $('script:not([src])');
                expect(inlineScripts.get()).toHaveLength(1);

                const script = inlineScripts.html();
                expect(script).toContain('__webpack_require__');

                setImmediate(done);
            } catch (e) {
                setImmediate(done, e);
            }
        });
    });
});
