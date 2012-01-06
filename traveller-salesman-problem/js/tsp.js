function TSP(){
	finished: false,
    this.log = function( text, error ){
		debug && console.log( "TSP.log()" );
        $( 'ul.log li.message' ).html( text );
		error && $( 'ul li.message' ).addClass( 'error' );
		!error && $( 'ul li.message' ).removeClass( 'error' );
    };
    this.data = {};
    this.Eucledian = function( c1, c2 ){
        return Math.sqrt( Math.pow( c1[ 0 ] - c2[ 0 ], 2 ) + Math.pow( c1[ 1 ] - c2[ 1 ], 2 ) );
    }
    this.LengthOfRoute = function( cities, route ){
		debug && console.log( "TSP.LengthOfRoute()" );
        var distance = 0;
        for( var i = 0; i < route.length - 1; ++i ){
            distance += this.Eucledian( cities[ route[ i ] ], cities[ route[ i + 1 ] ] );
        }
        return distance;
    };
    this.LogPathDistance = function(){
		debug && console.log( "TSP.LogPathDistance()" );
        if( !this.data.cities || !this.data.route ){
            return;
        }
        this.log( "Length of route so far: " + this.LengthOfRoute( this.data.cities, this.data.route ) );
    };
    this.Finish = function(){
        this.log( "Problem solved. Thank you!" );
		this.finished = true;
    };
    this.Request = function( request ){
        debug && console.log( "tsp.Request()" );
		if( this.finished || !this.running ){
			return;
		}
		
        this.lastRequest = new Date().getTime();
        var begin = new Date().getTime();
        var that = this;
        $.getJSON( 'api/server.js', request, function( results ){
            if( that.finished || !that.running ){
                return;
            }
            var networktime = new Date().getTime() - begin;
            if( !results || results.command == "failure" ){
                that.log( "Server is down for maintenance. The process will continue automatically, when the server is available.", true );
                that.running = false;
                return;
            }
            
            if( !isNaN( parseInt( results.userid ) ) ){
                that.userid = results.userid;
                Cookies.write( 'userid', results.userid );
            }
            that.Handle( results, networktime );
        } );
    };
	
    this.Handle = function( data, networktime ){
        debug && console.log( "tsp.Handle()" );
        switch( data.command ){
            case "finish":
                this.Finish();
                return;
            case "reload":
                window.location = "";
                return;
        }
        // case "run"
        if( data.cities ){
            this.data.cities = data.cities;
            Workers.Submit( { 
                command: "cities",
                cities: this.data.cities
            } );
        }
        if( data.route ){
            this.data.route = data.route;
            Workers.Submit( {
                command: "route",
                route: this.data.route
            } );
        }
        if( data.run ){
            this.data.run = data.run;
            $( '.log li:first .step' ).text( data.run );
        }
        this.data.partition = data.partition; 
		//solve
		this.count = 0;
		this.results = [];
		this.log( "Running. This may take several minutes." );
		var that = this;
        Workers.Solve( this.data.partition, function( result ){
			var req = {
                command: "Results",
                run: that.data.run,
                gain: result.min,
                flip: JSON.stringify( result.flip ),
                partition: JSON.stringify( that.data.partition ),
                partitionsize: Workers.threadNum,
                userid: that.userid,
                time: JSON.stringify( {
                    network: networktime,
                    calculations: result.time
                } ),
                version: this.version
			};
            that.Request( req );
        } );
    };
    this.Stop = function(){
		debug && console.log( "TSP.Stop()" );
        Cookies.write( 'run', 0 );
        this.running = false;
    }
    this.Start = function(){
		debug && console.log( "TSP.Start()" );
        Cookies.write( 'run', 1 );
		setInterval( updateusers, 10 * 1000 );
		Workers.Init();
        this.running = true;
		var req = {
			command: "Initialize",
			partitionsize: Workers.threadNum,
			userid: this.userid,
			name: Cookies.read( 'username' ),
			version: this.version
		};
        this.Request( req );
    }
    this.Restart = function(){
		debug && console.log( "TSP.Restart()" );
        debug && console.log( "tsp.Restart()" );
        Workers.Restart();
		this.running = true;
		var req = {
			command: this.data.cities ? "Request" : "Initialize",
			partitionsize: Workers.threadNum,
			userid: this.userid,
			name: Cookies.read( 'username' ),
			version: this.version
		};
		this.Request( req );
    }
}
