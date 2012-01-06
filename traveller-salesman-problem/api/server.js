var http = require('http');
var fs = require( 'fs' );
var path = require( 'path' );
var url = require( 'url' );

var Users = {
    users: [],
    requests: [],
    get: function( id ){
        if( this.users[ id ] ){
            return this.users[ id ];
        }
        id = this.users.length;
        this.users[ id ] = new user( id );
        return this.users[ id ];
    },
    cleanup: function(){
        for( var i in Users.users ){
            var user = Users.users[ i ];
			if( !user ){
				Users.users.splice( i, 1 );
			}
            if( user && user.lastaccess < new Date().getTime() - 65 * 1000 ){
                user.state = "stopped";
            }
			if( user.state == "stopped" && user.solved == 0 ){
				Users.users.splice( i, 1 );
			}
        }
    },
	running: function(){
		var counter = 0;
		for( var i in Users.users ){
			var user = Users.users[ i ];
			if( user.state == "running" ){
				counter += user.partitionsize - 0;
			}
		}
		return counter;
	}
};
setInterval( Users.cleanup, 15 * 1000 );


function user( id, name ){
    if( typeof id == 'object' ){
        var user = id;
        this.id = user.id;
        this.name = user.name;
        this.solved = user.solved;
        this.time = user.time;
        this.lastaccess = user.lastaccess;
        this.state = user.state;
    }
    else{
        this.id = id;
        this.name = name ? name : "User " + id;
        this.solved = 0;
        this.time = 0;
        this.lastaccess = new Date().getTime();
        this.state = "running";
    }
    this.update = function(){
        if( this.state == "running" ){
            this.time += new Date().getTime() - this.lastaccess;
        }
        this.lastaccess = new Date().getTime();
        this.state = "running";
    }
}

function TSP( options ){
    this.cities = [];
    this.route = [];
    this.options = options;
    this.begin = new Date().getTime(); 
    //function Eucledian calculates the eucledian distance between cities c1 and c2.
    this.Eucledian = function( c1, c2 ){
        return Math.sqrt( Math.pow( c1[ 0 ] - c2[ 0 ], 2 ) + Math.pow( c1[ 1 ] - c2[ 1 ], 2 ) );
    }
    //function LengthOfRoute calculates the total length of the route
    this.LengthOfRoute = function( cities, route ){
        var distance = 0;
        for( var i = 0; i < route.length - 1; ++i ){
            distance += this.Eucledian( cities[ route[ i ] ], cities[ route[ i + 1 ] ] );
        }
        return distance;
    }
    //functions SaveState and RestoreState is a backup mechanism to ensure the continue of the execution
    //in case of power or software failure.
    this.SaveState = function(){
        var requests = "";
        while( req = Users.requests.shift() ){
            requests += JSON.stringify({
                partitionsize: req.partitionsize,
                run: req.run || this[ '3opt' ].run,
                timestamp: new Date().getTime(),
                userid: req.userid,
                time: req.time ? JSON.parse( req.time ) : false,
                gain: req.gain || 0,
				flip: req.flip || false
            }) + "\n";
        }
        
        var fd = fs.openSync( 'requests.log', 'a' );
        fs.writeSync( fd, requests, 'utf8' );
        fs.closeSync( fd );

        fs.writeFileSync( "backup.json" , JSON.stringify( { 
            route: this.route,
            InitialRoute: this.route,
            run: this[ '3opt' ].run,
            users: Users.users,
            runs: this[ '3opt' ].runs,
            begin: this.begin,
            finish: this.finish
        } ), 'utf8' );
    }
    this.RestoreState = function(){
        if( !path.existsSync( "backup.json" ) ){
            return;
        }
        var data = JSON.parse( fs.readFileSync( "backup.json" ) );
        this.begin = data.begin;
        this.route = data.route;
        this[ '3opt' ].route = data.route.concat( data.route[ 0 ] );
        this[ '3opt' ].run = data.run;
        Users.users = [];
        for( var i in data.users ){
            Users.users[ i ] = new user( data.users[ i ] );
        }
        this[ '3opt' ].cities = this.cities;
        this[ '3opt' ].runs = data.runs;
    }
    //function Load loads the cities from the given .tsp file
    this.Load = function( number ){
        this.cities = [];
        var data = fs.readFileSync( this.options.path, "UTF-8" );
        data = data.split( "\n" );
        if( !number || number > data.length ){
            number = data.length;
        }
        for( var i = 0; i < number; ++i ){
            if( !parseInt( data[ i ][ 0 ] ) ){
                continue;
            }
            var cur = data[ i ].split( ' ' );
            this.cities.push( [ cur[ 1 ], cur[ 2 ] ] );
        }
    }
    //function Greedy calculates a route using the nearest neighbor algorithm
    this.Greedy = function(){
        if( !this.cities.length ){
            console.log( "The cities have to be loaded before a TSP algorithm can be used" );
        }
        var cities = this.cities;
        var visited = [];
        for( var i = 0; i < cities.length; ++i ){
            visited.push( false );
        }
        var route = [ 0 ];
        var id = 0;
        visited[ id ] = true;
        while( true ){
            var min = Infinity;
            var active = false;
            for( var j = 0; j < cities.length; ++j ){
                if( visited[ j ] ){
                    continue;
                }
                active = true;
                var d = this.Eucledian( cities[ id ], cities[ j ] );
                if( d < min ){
                    var min = d;
                    var index = j;
                }
            }
            if( !active ){
                break;
            }
            route.push( index );
            visited[ index ] = true;
            id = index;
        }
        return route;
    }
    
    //the object 3opt is responsible for the distributed execution of the algorithm 3-opt to the clients.
    this[ "3opt" ] = {
		currentLength: null,
        running: [],
        parent: this,
        pending: [],
        cities: [],
        route: [],
        run: 0,
        runs: [],
        solved: 0,
        sum: 0,
        optimal: {
            "gain": 0,
            "flip": []
        },
        // function Initialize sould be executed once, in the begining
        Initialize: function(){
            this.cities = this.parent.cities;
            this.route = this.parent.route.concat( this.parent.route[ 0 ] );
        },
        // function NextRun runs in every step of the 3-opt algorithm, and re-initializes the problem
        NextRun: function(){
            if( this.clean ){
                return;
            }
			this.currentLength = this.parent.LengthOfRoute( this.parent.cities, this.route );
            this.runs.push({
                run: this.run,
                solved: this.solved,
                total: this.currentLength,
                optimal: this.optimal,
				timestamp: new Date().getTime()
            });
			
			// shifting the route by the allready solved cities.
			// that's an optimization step.
			var size = this.solved || Users.running();
			if( this.solved != 1500 ){
				var newroute = this.route.concat();
				newroute.pop();
				newroute = newroute.splice( newroute.length - size ).concat( newroute );
				newroute.push( newroute[ 0 ] );
				this.route = newroute;
			}
			
			
            this.run++;
            this.running = [];
            this.pending = this.route.concat().splice( 0, this.route.length - 2 ); // to avoid copy with reference
            this.optimal = { "gain": 0, "flip": [] };
            this.clean = true;
            console.log( "Flipped. Run: " + this.run + ", Distance: " + this.currentLength );
            this.parent.route = this.route.concat().splice( 0, this.route.length - 1 );
            this.solved = 0;
        },
        //function Flip changes the route according to the 3-opt algorithm
        Flip: function( flip ){
            var i = flip[ 0 ], j = flip[ 1 ], k = flip[ 2 ];
            var n = this.route.length;
            var route = this.route;
            var newroute = [];
            
            for ( var z = 0; z <= i; z++ ) {
                newroute.push( route[ z ] );
            }
            for ( var z = j; z >= i + 1; z-- ) {
                newroute.push( route[ z ] );
            }
            for ( var z = k; z >= j + 1; z-- ) {
                newroute.push( route[ z ] );
            }
            for ( var z = k + 1; z < n; z++ ) {
                newroute.push( route[ z ] );
                //newroute's size is n+1
            }
			
            return newroute;
        },
        //function GetPartition returns a block of cities to send to the clients. 
        //if there are not any cities left, calls Flip with the optimal flip and continues the run-flow
        //if there is not a flip that sortens the route, the 3-opt algorithm has been completed.
        GetPartition: function( size ){
			size *= this.solved < 500 ? 20 : this.solved < 1000 ? 10 : this.solved < 1500 ? 5 : 1;
			
            var items = [];
			for( var i = 0; i < size; ++i ){
				if( this.pending.length ){
					items.push( this.pending.pop() ); //shift()
					this.running.push( items[ i ] );
				}
			}
            var counter = 0;
            for( var i = items.length; i < size; ++i ){
                if( this.running.length > counter ){
                    items.push( this.running[ counter++ ] );
                }
            }
            if( !items.length ){
				//algorithm finish condition
                if( this.optimal.gain == 0 ){
                    this.finished = true;
                    this.parent.finish = new Date().getTime();
                    return { command: "finish" };
                }
                this.route = this.Flip( this.optimal.flip );
                this.NextRun();
                return this.GetPartition( size );
            }
            return { command: "run", partition: items };
        },
        // function Handle is responsible to handle the user requests.
        // It has two modes: Initialize and Results. The first one runs when the user joins the process, while
        // the second when he returns results and asks for the next partition of the problem.
        Handle: function( request ){
            if( this.finished ){
                return {
                    command: "finish"
                };
            }
            this.clean = false;
            var user = Users.get( request.userid );
			var res = {};
            switch( request.command ){
                case "Initialize":
					res.cities = this.cities;
				case "Request":
					res.route = this.route;
					break;
                case "Results":
                    request.flip = JSON.parse( request.flip );
                    request.partition = JSON.parse( request.partition );
					var partlength = request.partition.length;
                    // when the best route has already been calculated for a run, we donot need the results of
                    // that run, so we ignore the results and the user takes the new route and a partition of the new run.
                    if( request.run != this.run ){
						res.route = this.route;
						break;
                    }
                    // if the calculated gain for this partition is better than the best, so far, we set the current as the best.
                   if( parseFloat( request.gain ) < parseFloat( this.optimal.gain ) ){
                        this.optimal = {
                            gain: request.gain, 
                            flip: request.flip 
                        };
                    }
                    // In this step, we remove the results from the running cities.
					for( var i = 0; i < request.partition.length; ++i ){
						for( var j = 0; j < this.running.length; ++j ){
							if( this.running[ j ] == request.partition[ i ] ){
								this.running.splice( j, 1 );
								break;
							}
						}
					}
					
                    this.solved += request.partition.length;
                    user.solved += request.partition.length;
					
                    // if more than 1% of the cities have been calculated, and the current gain is good enough,
                    // we accept it and restart the run. This is an optimization to sorten the execution time for each run.
                    // 3-optimal results are not threatened, as the algorithm still terminates when there is not any optimization left
					// IGNORE THE ABOVE
					
					var multi = this.solved < 500 ? 20 : this.solved < 1000 ? 10 : this.solved < 1500 ? 5 : 1;
                    if( this.optimal.gain && this.solved > Users.running() * multi * 2 ){
						this.route = this.Flip( this.optimal.flip );
						this.NextRun();
						res.route = this.route;
                    }
					break;
            }
			var part = this.GetPartition( request.partitionsize );
			res.command = part.command;
			res.partition = part.partition;

			res.userid = user.id;
			res.run = this.run;
			request.partitionsize = partlength;
			return res;
        }
    };
}

var tsp = new TSP( { path: 'ca4663.tsp' } );

tsp.Load();
tsp.RestoreState();

tsp.clientversion = fs.readFileSync( 'version', "UTF-8" ).split( "\n" )[ 0 ];
console.log( tsp.clientversion );
setInterval( function(){
    var clientversion = fs.readFileSync( 'version', "UTF-8" ).split( "\n" )[ 0 ];
    if( clientversion != tsp.clientversion ){
        console.log( clientversion );
        tsp.clientversion = clientversion;
    }
}, 1000 );

if( tsp[ '3opt' ].run == 0 ){
    tsp.route = tsp.Greedy();
    tsp[ "3opt" ].Initialize();
}
tsp.initialRoute = tsp.initialRoute || tsp.route.concat();

tsp[ "3opt" ].NextRun();
setInterval( function(){tsp.SaveState()}, 20 * 1000 );

console.log( "Ready" );


http.createServer( function( request, response ){
    request = url.parse( request.url, true ).query;
    request = JSON.parse( JSON.stringify( request ) );
    response.writeHead( 200, {'Content-Type': 'text/json'} );
    if( request.version != tsp.clientversion ){
        response.end( JSON.stringify({ command: "reload" }) );
        return;
    }
    if( tsp.finish ){
        response.end( JSON.stringify( { command: "finish" } ) );
        return;
    }
    
    var user = Users.get( request.userid );
	request.userid = user.id;
	user.partitionsize = request.partitionsize || user.partitionsize || 4;
    request.timestamp = new Date().getTime();
    
	var res;
    switch( request.command ){
        case "rename":
			user.name = request.name || user.name;
			res = { command: "success" };
			break;
        case "update":
            !tsp.finish && user.update();
            res = {
				command: "update",
                users: Users.users,
                run: tsp[ '3opt' ].run,
				userid: user.id
            };
            break;
        case "Initialize":
			user.name = request.name || user.name;
		case "Request":
        case "Results":
            res = tsp[ '3opt' ].Handle( request );
			Users.requests.push( request );
            console.log( user.name + " requested a new partition. Solved for that run " + tsp[ '3opt' ].solved + " cities." );
            break;
        default:
            res = { command: "failure" };
    }
    response.end( res ? JSON.stringify( res ) : "" );
}).listen( 6060 );
