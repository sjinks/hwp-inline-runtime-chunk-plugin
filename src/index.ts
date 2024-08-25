import type { Compilation, Compiler, sources } from 'webpack';
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

    public apply(compiler: Compiler): void {
        compiler.hooks.compilation.tap(PLUGIN, (compilation: Compilation): void => {
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

    private _getPublicPath(compiler: Compiler): string {
        // 'undefined' route seems to be never taken, because webpack populates `options.output`
        const path = compiler.options.output?.publicPath;

        /* istanbul ignore else */
        if (typeof path === 'string') {
            // See https://github.com/jantimon/html-webpack-plugin/issues/1514
            if (path === 'auto') {
                return '';
            }

            if (path.length) {
                return path.endsWith('/') ? path : `${path}/`;
            }
        }

        /* istanbul ignore next */
        return '';
    }

    private _getRuntimeUris(compilation: Compilation): RuntimeUri[] {
        const publicPath = this._getPublicPath(compilation.compiler);
        const result: RuntimeUri[] = [];

        compilation.entrypoints.forEach((entry) => {
            const runtimeChunk = entry.getRuntimeChunk();

            /* istanbul ignore else */
            if (runtimeChunk) {
                runtimeChunk.files.forEach((file) => result.push({ file, url: publicPath + file }));
            }
        });

        return result;
    }

    private _inlineRuntimes(runtimeUris: RuntimeUri[], compilation: Compilation) {
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

    private _getAssetSourceCode(compilation: Compilation, file: string): string | undefined {
        const entries = Object.entries(compilation.assets);
        const entry: [string, sources.Source] | undefined = entries.find((item) => item[0] === file);
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
