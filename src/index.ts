import type webpack from 'webpack';
import type { Source } from 'webpack-sources';
import HtmlWebpackPlugin, { HtmlTagObject } from 'html-webpack-plugin';

export interface Options {
    removeSourceMap?: boolean;
}

const PLUGIN = 'HwpInlineRuntimeChunkPlugin';

interface RuntimeUri {
    file: string;
    url: string;
}

export class HwpInlineRuntimeChunkPlugin {
    private _options: Required<Options>;

    public constructor(options: Options = {}) {
        this._options = {
            removeSourceMap: options.removeSourceMap ?? false,
        };
    }

    public apply(compiler: webpack.Compiler): void {
        compiler.hooks.compilation.tap(PLUGIN, (compilation: webpack.compilation.Compilation): void => {
            const runtimeChunkOption = compiler.options.optimization && compiler.options.optimization.runtimeChunk;
            if (runtimeChunkOption) {
                const hooks = HtmlWebpackPlugin.getHooks(compilation);
                hooks.alterAssetTags.tapAsync(PLUGIN, (data, cb): unknown => {
                    const runtimeUris = this._getRuntimeUris(compilation);
                    data.assetTags.scripts.forEach(this._inlineRuntimes(runtimeUris, compilation));
                    return cb(null, data);
                });
            }
        });
    }

    private _getPublicPath(compiler: webpack.Compiler): string {
        // 'undefined' route seems to be never taken, as webpack populates `options.output`
        const path = compiler.options.output
            ? compiler.options.output.publicPath /* istanbul ignore next */
            : undefined;
        if (typeof path === 'string') {
            return path.slice(-1) === '/' ? path : `${path}/`;
        }

        /* istanbul ignore next */
        return '';
    }

    private _getRuntimeUris(compilation: webpack.compilation.Compilation): RuntimeUri[] {
        const publicPath = this._getPublicPath(compilation.compiler);
        const result: RuntimeUri[] = [];

        compilation.entrypoints
            // entry is Entrypoint, but webpack does not provide its type definition
            // see https://github.com/webpack/webpack/blob/webpack-4/lib/Entrypoint.js
            .forEach((entry) => {
                const runtimeChunk: webpack.compilation.Chunk = entry.getRuntimeChunk();
                runtimeChunk.files.forEach((file) => result.push({ file, url: publicPath + file }));
            });

        return result;
    }

    private _inlineRuntimes(runtimeUris: RuntimeUri[], compilation: webpack.compilation.Compilation) {
        return (tag: HtmlTagObject): void => {
            if (tag.attributes.src) {
                const match = runtimeUris.find((uri) => uri.url === tag.attributes.src);
                if (match) {
                    const content = this._getAssetSourceCode(compilation, match.file);
                    /* istanbul ignore else - the runtime chunk always exists, so does its source code */
                    if (content) {
                        tag.innerHTML = this._options.removeSourceMap
                            ? content.replace(/\/\/# sourceMappingURL=(.+)$/, '')
                            : content;

                        delete tag.attributes.src;
                    }
                }
            }
        };
    }

    private _getAssetSourceCode(compilation: webpack.compilation.Compilation, file: string): string | undefined {
        const entries = Object.entries<Source>(compilation.assets);
        const entry: [string, Source] | undefined = entries.find((item) => item[0] === file);
        /* istanbul ignore else - the runtime chunk always exists (at least under normal circumstances) */
        if (entry) {
            const source = entry[1].source();
            /* istanbul ignore else - because the runtime chunk always exists, we should always be able to retrieve its source */
            if (typeof source === 'string') {
                return source;
            }

            /* istanbul ignore next - no idea how to get ArrayBuffer from source() */
            return String.fromCharCode.apply(null, [...new Uint16Array(source)]);
        }

        /* istanbul ignore next */
        return undefined;
    }
}
