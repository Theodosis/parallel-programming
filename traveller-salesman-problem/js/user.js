$( function(){
    window.dtusers = $( '.users' ).dataTable( {
        "bInfo": false,
        "bLengthChange": false,
        "bPaginate": false,
        "bSearchable": false,
        "bFilter": false,
        "aoColumns": [
            { "bVisible": false, "mDataProp": "id" },
            { 
                "sTitle": "User", 
                "mDataProp": "name",
                "fnRender": function( o ){
                    if( o.aData.id == Cookies.read( 'userid' ) ){
                        var name = Cookies.read( 'username' );
                        return "<a href='javascript:rename()'>" + ( name ? name : "Me" ) + "</a><input type='text' />";
                    }
                    return o.aData.name;
                }
            },
            { "sTitle": "Solved", "mDataProp": "solved" },
            { 
                "sTitle": "Total Time", 
                "mDataProp": "time",
                "fnRender": function( o ){
                    var ms = parseInt( o.aData.time );
                    var s = parseInt( ( ms / 1000 ) % 60 ),
                        m = parseInt( ( ms / 1000 / 60 ) % 60 ),
                        h = parseInt( ms / 1000 / 60 / 60 );
                    
                    var ss = s + "sec",
                        mm = m + "min ",
                        hh = h + "h ";

                    return h ? hh + mm : mm;
                }
            },
            { "sTitle": "Current State", "mDataProp": "state" }
        ],
        "aaData": []
    } );
} );


function updateusers(){
	debug && console.log( "updateusers()" );
    if( tsp.finish ){
        return;
    }
	var req = {
		command: "update",
		userid: Cookies.read( 'userid' ),
		name: Cookies.read( 'username' ),
		version: Cookies.read( 'version' )
	};
	
    $.getJSON( 'api/server.js', req, function( data ){
		debug && console.log( "Updated" );
		debug && console.log( data );
        if( !data || data.command == "failure" ){
            tsp.log( "Server is down for maintenance. The process will continue automatically, when the server is available.", true );
			tsp.error = true;
            return;
        }
		( data.command == "reload" || tsp.error ) && window.location.reload();
        //data.run != tsp.data.run && tsp.Restart();
		
        tsp.userid = data.userid;
		Cookies.write( 'userid', data.userid );
		
		//if( !$( 'table .edit' ).length ){
            window.dtusers.fnClearTable();
            window.dtusers.fnAddData( data.users );
        //}
    } );
}
function rename(){
    $( 'table a' ).parent().addClass( 'edit' );
    $( 'table input' ).val( $( 'table a' ).text() );
}
$( 'table input' ).live( 'keyup',  function( e ){
    var which = e.which || e.keyCode || e.charCode;
    if( which == 13 ){
        var username = $( 'table input' ).val();
        $( 'table a' ).text( username );
        Cookies.write( 'username', username );
		var req = {
			userid: Cookies.read( 'userid' ),
			name: username,
			command: rename,
			version: tsp.version
		};
        $.get( 'api/server.js', req );
        $( this ).parent().removeClass( 'edit' );
    }
    if( which == 27 ){
        $( this ).parent().removeClass( 'edit' );
    }
} );
