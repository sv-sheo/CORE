
const path      = require('path');
const webpack   = require('webpack');

const plugins = {
    
    css_extract_plugin:     require('mini-css-extract-plugin'),
    terser_webpack_plugin: 	require('terser-webpack-plugin'),
    
}

module.exports =    {
    
                        context:    path.resolve(__dirname, './../../../'), // the rest of paths shall be relative to this one - for dev server = /sites/opajda/
    
                        mode:       'production', //production or development | https://webpack.js.org/concepts/mode/
    
                        //devtool:    'cheap-module-source-map', // 'cheap-module-source-map'
                        devtool:    'hidden-nosources-source-map', // source-map, 'cheap-module-source-map'

                        entry: {
                            
                            // keys of entry are the name of the outputted files [name]
                            
                            // frontend base
                            desktop:        ["./files/js/desktop/root.js"],        // babel polyfill will be automatically required at the start - enabling native Promise, Object.assign etc
                            mobile:       	["./files/js/mobile/root.js"],
                            //admin:          ["./files/js/backend_admin/root.js"],
                            
                        },

                        output: {
                            
                            path:               path.resolve(__dirname, "./../../../files/build/production/"),
                            filename:           "[name].js",
                            //sourceMapFilename:  '[name].map',
                            pathinfo:           true                      // include name of file in comment 

                        },

						optimization: {

							minimize: true,
							minimizer: [
								new plugins.terser_webpack_plugin({ 
									extractComments: false, 
									terserOptions: { format: { comments: false } },
								}),
							],

						},
    
                        module: {

                            rules: [
                                
                                { // BABEL LOADER + REACT
                                    
                                    test: /\.js$|\.jsx/,
                                    exclude: /(node_modules|bower_components)/,
                                    use: {
                                            loader: 'babel-loader',
                                            options: {
                                                //presets: ['babel-preset-env', 'react'] 
                                                // presets: ['env', 'react'] 
                                                presets: ["@babel/preset-env", "@babel/preset-react"]
                                                }
                                    }
                                    
                                },
                                
                                { // SASS
                                    
                                    test:   /\.s?[ac]ss$/, // /\.(s*)css$/, // css or scss
                                    use:    [
                                                plugins.css_extract_plugin.loader,
                                        
                                                {   loader: 'css-loader',     options: { url: false, sourceMap: true } },
                                        
                                                {   
                                                    loader: 'sass-loader',    
                                                    options: { 
                                                                sourceMap:      true, 
                                                                sassOptions: {
                                                                    
                                                                    outputStyle:    'compressed', 
                                                                    //includePaths: [path.resolve("./js/node_modules/bootstrap-sass/assets/stylesheets")] // prepends bootstrap to every build file
                                                                }
                                                    } 
                                                }
                                            ],
                                    
                                },
                                
                            ]

                        },
    
                        plugins: [
                            
                            new plugins.css_extract_plugin({ 
                                            
                                filename: "[name].css",         // available at DEV SERVER publicPath ( localhost:4333/blergh.css )

                            }),
                            
                        ],
    
                        resolve: {

                            extensions: ['.js', '.js', '.css', '.sass'],
                            modules: ['node_modules']   
                            
                        },
    
                    }
