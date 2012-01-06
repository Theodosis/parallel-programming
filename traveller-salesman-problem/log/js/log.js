var Eucledian = function( c1, c2 ){
    return Math.sqrt( Math.pow( c1[ 0 ] - c2[ 0 ], 2 ) + Math.pow( c1[ 1 ] - c2[ 1 ], 2 ) );
}
var LengthOfRoute = function( cities, route ){
    var distance = 0;
    for( var i = 0; i < route.length - 1; ++i ){
        distance += Eucledian( cities[ route[ i ] ], cities[ route[ i + 1 ] ] );
    }
    return distance;
}

var zeros = function( number ){
    var arr = [];
    for( var i = 0; i < number; ++i ){
        arr[ i ] = 0;
    }
    return arr;
}

var Log = {
    repeat: 2,
	optimal: [],
    step: 60 * 60 * 1000,
    load: function(){
        Log.chart && Log.chart.setLoading( "Loading..." );
        Log.optimal = [];
		var a, b, c;
        $.getJSON( '../run' + Log.repeat + '/data.json', function( data ){
            a = data;
            if( b && c ){
                setTimeout( function(){ Log.BuildCharts( a, b ); }, 10 );
            }
        } );
        $.get( '../run' + Log.repeat + '/requests.log', function( data ){
            data = data.split( "\n" );
            data.splice( -1 );
            data = JSON.parse( '[' + data.join( ',' ) + ']' );
            b = data;
            if( a && c ){
                setTimeout( function(){ Log.BuildCharts( a, b ); }, 10 );
            }
        } );
		$.get( '../ca4663.tour', function( data ){
			data = data.split( "\n" );
			for( var i in data ){
				var row = data[ i ];
				if( isNaN( parseInt( row ) ) || parseInt( row ) == -1 ){
					continue;
				}
				Log.optimal.push( parseInt( row ) - 1 );
			}
			Log.optimal.push( Log.optimal[ 0 ] );
			c = true;
			if( a && b ){
				setTimeout( function(){ Log.BuildCharts( a, b ); }, 10 );
			}
		} );
    },
    BuildCharts: function( data, requests ){
        Log.StoreData( data, requests );
        var tt = Log.timetableData();
        var ttcf = Log.timetableConfig( tt.store, tt.fields );

        var sr = Log.perRunData();
        var srcf = Log.perRunConfig( sr.store, sr.fields );

        var lor = Log.routeLengthData();
        var lorcf = Log.routeLengthConfig( lor.store, lor.fields );

		var ipr = Log.improvementPerRunData();
        var iprcf = Log.improvementPerRunConfig( ipr.store, ipr.fields );
		
		var tpr = Log.timePerRunData();
		var tprcf = Log.timePerRunConfig( tpr.store, tpr.fields );
		
		var rcf = Log.routeConfig();
		Log.chart && Log.chart.el.remove();
        Log.chart = Ext.create('Ext.tab.Panel', Log.config([ ttcf, srcf, lorcf, iprcf, tprcf, rcf ] ) );
    },
    StoreData: function( data, requests ){
        Log.begin = data.begin;
        Log.end = data.finish || new Date().getTime();
        Log.run = data.run;
		Log.users = {};
		
        for( var i in data.users ){
            var user = data.users[ i ];
            Log.users[ user.id ] = user;
            user.requests = [];
        }
        for( var i = 0; i < requests.length; ++i ){
            var req = requests[ i ];
            if( !req.timestamp || !req.gain ){
                continue;
            }
            
            Log.users[ req.userid ].requests.push( req );
        }
        for( var i in Log.users ){
			var user = Log.users[ i ];
			if( !user.requests.length ){
				delete Log.users[ i ];
			}
		}
		
		Log.requests = requests;
        Log.runs = data.runs;
		Log.route = data.route.concat( data.route[ 0 ] );
    },
    
	timetableData: function(){
        var diff = Log.end - Log.begin;
        var step = this.step;
        var cols = diff / step;
        var fields = [];
        for( var i in Log.users ){
            var user = Log.users[ i ];
            user.timeline = zeros( cols );

            for( var j = 0; j < user.requests.length; ++j ){
                var req = user.requests[ j ];
                var timeslot = parseInt( ( req.timestamp - Log.begin ) / step );
                user.timeline[ timeslot ] += ( req.partitionsize - 0 ) || 0;
            }
            fields.push( 'user' + user.id );
        }
        var storedata = [];
        for( var i = 0; i < cols; ++i ){
            var d = new Date( Log.begin + step * i );
            storedata[ i ] = {
                timestamp: Ext.Date.format( new Date( Log.begin + step * i ), 'D d, H:i' ),
            };
            for( var j in Log.users ){
                var user = Log.users[ j ];
                storedata[ i ][ 'user' + user.id ] = user.timeline[ i ];
            }
        }
        return {
            store: Ext.create( "Ext.data.JsonStore", {
                fields: [ 'timestamp' ].concat( fields ),
                data: storedata
            } ),
            fields: fields
        };
    },
	timetableConfig: function( store, fields ){
        var series = [];
        for( var i in Log.users ){
            series.push( {
                title: Log.users[ i ].name,
                type: 'line',
                highlight: {
                    size: 10,
                    radius: 10
                },
                axis: 'left',
                xField: 'timestamp',
                yField: 'user' + Log.users[ i ].id,
                markerConfig: {
                    type: 'circle',
                    size: 4,
                    radius: 4,
                    'stroke-width': 0
                }
            } );
        }
        return {
            title: "Time Table",
            xtype: 'chart',
            store: store,
            legend: {
                position: 'right'
            },
            axes: [{
                type: 'Numeric',
                minimum: 0,
                position: 'left',
                fields: fields,
                title: 'Cities Solved Per Hour',
                minorTickSteps: 1,
                grid: {
                    odd: {
                        opacity: 1,
                        fill: '#ddd',
                        stroke: '#bbb',
                        'stroke-width': 0.5
                    }
                }
            }, {
                type: 'Category',
                position: 'bottom',
                fields: 'timestamp',
                title: 'Timeline',
                label: {
                    rotate: {
                        degrees: 300
                    }
                }
            }],
            series: series
        };
    },
    
	perRunData: function(){
        var fields = [];
        for( var i in Log.users ){
            fields.push( 'user' + Log.users[ i ].id );
        }
        var storedata = [];
        for( var i = 0; i < Log.run; ++i ){
            storedata[ i ] = { run: i };
            for( var j in Log.users ){
                storedata[ i ][ 'user' + j ] = 0;
            }
            storedata[ i ][ 'total' ] = 0;
        }
        for( var i in Log.requests ){
            var req = Log.requests[ i ];
            if( !storedata[ req.run ] ){
                continue;
            }
            storedata[ req.run ][ 'user' + req.userid ] += req.partitionsize - 0;
        }
		for( var i in Log.runs ){
			var run = Log.runs[ i ];
			storedata[ i ][ 'total' ] = run.solved;
		}
		for( var i in storedata ){
			for( j in storedata[ i ] ){
				if( !storedata[ i ][ j ] ){
					storedata[ i ][ j ] = 0;
				}
			}
		}
        return {
            store: Ext.create( "Ext.data.JsonStore", {
                fields: [ 'run', 'total' ].concat( fields ),
                data: storedata
            } ),
            fields: fields
        };
    },
    perRunConfig: function( store, fields ){
        var series = [];
        for( var i in Log.users ){
            series.push( {
                title: Log.users[ i ].name,
                type: 'line',
                axis: 'left',
                xField: 'run',
                yField: 'user' + Log.users[ i ].id,
				showMarkers: false,
				smooth: 25,
                markerConfig: {
                    type: 'circle',
                    size: 4,
                    radius: 4,
                    'stroke-width': 0
                }

            } );
        }
        series.push( {
            title: "Total",
            type: 'line',
            axis: 'left',
            xField: 'run',
            yField: 'total',
			showMarkers: false,
			smooth: 25,
            markerConfig: {
                type: 'circle',
                size: 4,
                radius: 4,
                'stroke-width': 0
            }
        } );
        return {
            title: "Solved per Run",
            xtype: 'chart',
            store: store,
            legend: {
                position: 'right',
            },
            axes: [{
                type: 'Numeric',
                minimum: 0,
                position: 'left',
                fields: [ 'total' ].concat( fields ),
                title: 'Cities Solved Per Run',
                grid: {
                    odd: {
                        opacity: 1,
                        fill: '#ddd',
                        stroke: '#bbb',
                        'stroke-width': 0.5
                    }
                }
            }, {
                type: 'Category',
                position: 'bottom',
                fields: 'run',
                title: 'Repeats',
            }],
            series: series
        };
    },
    
	routeLengthData: function(){
        var storedata = [];
        for( var i = 0; i < Log.runs.length; ++i ){
            storedata[ i ] = {
                run: i,
                length: Log.runs[ i ].total
            };
        }
        return {
            store: Ext.create( "Ext.data.JsonStore", {
                fields: [ 'run', 'length' ],
                data: storedata
            } ),
            fields: [ 'length' ]
        };
    },
    routeLengthConfig: function( store, fields ){
        var series = [{
            title: "Length of Route",
            type: 'line',
            axis: 'left',
            xField: 'run',
            yField: 'length',
			showMarkers: false,
        }];

        return {
            title: "Length of Route",
            xtype: 'chart',
            store: store,
            legend: false,
            axes: [{
                type: 'Numeric',
                minimum: 1290319,
                position: 'left',
                fields: fields,
                title: 'Length of Route',
                grid: {
                    odd: {
                        opacity: 1,
                        fill: '#ddd',
                        stroke: '#bbb',
                        'stroke-width': 0.5
                    }
                }
            }, {
                type: 'Category',
                position: 'bottom',
                fields: 'run',
                title: 'Repeats',
            }],
            series: series
        };
    },
    
	improvementPerRunData: function(){
		var storedata = [];
		for( var i = 0; i < Log.runs.length; ++i ){
			storedata[ i ] = {
				run: i,
				improvement: Math.abs( Log.runs[ i ].optimal.gain )
			};
		}
		return {
			store: Ext.create( "Ext.data.JsonStore", {
				fields: [ 'run', 'improvement' ],
				data: storedata
			} ),
			fields: [ 'improvement' ]
		};
	},
	improvementPerRunConfig: function( store, fields ){
       var series = [{
            title: "Improvement Per Run",
            type: 'line',
            axis: 'left',
            xField: 'run',
            yField: 'improvement',
			showMarkers: false,
        }];

        return {
			title: "Improvement Per Run",
            xtype: 'chart',
            store: store,
            legend: false,
            axes: [{
                type: 'Numeric',
                minimum: 0,
                position: 'left',
                fields: fields,
                title: 'Improvement',
                grid: {
                    odd: {
                        opacity: 1,
                        fill: '#ddd',
                        stroke: '#bbb',
                        'stroke-width': 0.5
                    }
                }
            }, {
                type: 'Category',
                position: 'bottom',
                fields: 'run',
                title: 'Repeats',
            }],
            series: series
        };
    },
	
	timePerRunData: function(){
		var storedata = [];
		for( var i = 0; i < Log.runs.length - 1; ++i ){
			if( !Log.runs[ i ].timestamp ){
				var time = 0;
			}
			else{
				var time = ( Log.runs[ i + 1 ].timestamp - Log.runs[ i ].timestamp ) / 1000;
			}
			time = time > 3000 ? 0 : time;
			storedata[ i ] = {
				run: i,
				time: time
			};
		}
		return {
			store: Ext.create( "Ext.data.JsonStore", {
				fields: ['run', 'time' ],
				data: storedata
			} ),
			fields: ['time' ]
		};
	},
    timePerRunConfig: function( store, fields ){
		var series = [{
			title: "Seconds for a Run",
			type: 'line',
			axis: 'left',
			xField: 'run',
			yField: 'time',
			showMarkers: false
		}];
		return {
			title: "Time Per Run",
			xtype: 'chart',
			store: store,
			legend: false,
			series: series,
            axes: [{
                type: 'Numeric',
                minimum: 0, //1290319,
                position: 'left',
                fields: fields,
                title: 'Seconds',
                grid: {
                    odd: {
                        opacity: 1,
                        fill: '#ddd',
                        stroke: '#bbb',
                        'stroke-width': 0.5
                    }
                }
            }, {
                type: 'Category',
                position: 'bottom',
                fields: 'run',
                title: 'Repeats',
            }],
		}
	},
	
	routeConfig: function(){
		return {
			xtype: "panel",
			title: "Current Route",
			html: '<canvas></canvas>',
			id: 'canvas',
			dockedItems: [{
				xtype: "toolbar",
				dock: 'right',
				items: [{
					text: 'Optimal',
					enableToggle: true,
					pressed: true,
					handler: function( b ){
						Route.clear();
						for( var i in b.ownerCt.items.items ){
							var button = b.ownerCt.items.items[ i ];
							if( button.getText() == "Optimal" && button.pressed ){
								Route.draw( Log.optimal, 'red' );
							}
							if( button.getText() == "Current" && button.pressed ){
								Route.draw( Log.route, 'blue' );
							}
						}
					}
				}, {
					text: 'Current',
					enableToggle: true,
					pressed: true,
					handler: function( b ){
						Route.clear();
						for( var i in b.ownerCt.items.items ){
							var button = b.ownerCt.items.items[ i ];
							if( button.getText() == "Optimal" && button.pressed ){
								Route.draw( Log.optimal, 'red' );
							}
							if( button.getText() == "Current" && button.pressed ){
								Route.draw( Log.route, 'blue' );
							}
						}
					}
				}]
			}],
			listeners: {
				afterLayout: function( item ){
					Route.init( $( '#canvas' ).width(), $( '#canvas' ).height() );
					Route.load();
					Route.clear();
					Route.draw( Log.optimal, 'red' );
					Route.draw( Log.route, 'blue' );
				}
			}
		}
	},
	
	config: function( items ){
        return {
            dockedItems: [{
                xtype: 'toolbar',
                dock: 'bottom',
                items: [{
                    text: 'First execution',
					enableToggle: true,
					toggleGroup: 'execution',
					toggleHandler: function(){
						Log.repeat = 1;
						Log.load();
					}
				}, {
                    text: 'Second execution',
					enableToggle: true,
					toggleGroup: 'execution',
					toggleHandler: function(){
						Log.repeat = 2;
						Log.load();
					}
				}]
            }],
            width: window.innerWidth,
            height: window.innerHeight,
            renderTo: Ext.getBody(),
            layout: 'fit',
            items: items
        };
    },
}

var Route = {
    cities: [],
    points: [],
    load: function(){
		var a, b;
		Route.cities = [];
		Route.points = [];
		Route.ready = false;
        $.get( '../ca4663.tsp', function( data ){
            data = data.split( "\n" );
            var min = [ 41800, 52667 ];
            var max = [ 82480, 140980 ];
            var diff = [ ( max[ 1 ] - min[ 1 ] ), ( max[ 0 ] - min[ 0 ] ) ];
            var scale = [ diff[ 0 ] / Route.canvas.width, diff[ 1 ] / Route.canvas.height ];
            var d = scale[ 0 ] > scale[ 1 ] ? scale[ 0 ] : scale[ 1 ];
            var counter = 0;
            for( var i = 0; i < data.length; ++i ){
                if( !parseInt( data[ i ][ 0 ] ) ){
                    continue;
                }
                var cur = data[ i ].split( ' ' );
                Route.cities[ counter++ ] = [ parseInt( cur[ 2 ] ), parseInt( cur[ 1 ] ) ];
                Route.points.push( [ 
                    Route.canvas.width - ( Route.cities[ counter - 1 ][ 0 ] - min[ 1 ] ) / d, //scale[ 0 ], 
                    Route.canvas.height - ( Route.cities[ counter - 1 ][ 1 ] - min[ 0 ] ) / d //scale[ 1 ] 
                ] );
            }
			Route.ready = true;
        } );
    },
    draw: function( route, color ){
		if( !Route.ready ){
			setTimeout( function(){ Route.draw( route, color ) }, 100 );
			return;
		}
        var point = this.points[ route[ 0 ] ];
        this.ctx.moveTo( point[ 0 ], point[ 1 ] );
        this.ctx.beginPath();
        for( var i = 1; i < route.length; ++i ){
            point = this.points[ route[ i ] ];
            this.ctx.lineTo( point[ 0 ], point[ 1 ] );
        }
		this.ctx.strokeStyle = color;
        this.ctx.stroke();
        this.ctx.closePath();
    },
	clear: function(){
		this.ctx.fillRect( 0, 0, this.canvas.width, this.canvas.height );
	},
    init: function( width, height ){
        this.canvas = $( 'canvas' )[ 0 ];
        this.canvas.width = width - 52;
        this.canvas.height = height;
        this.ctx = this.canvas.getContext( '2d' );
		this.ctx.fillStyle = "white";
    }
}

$( function(){
    Log.load();
    //setInterval( function(){ Log.load(); }, 60 * 1000 );
} );
