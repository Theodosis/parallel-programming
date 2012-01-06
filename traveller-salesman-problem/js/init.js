var version = "3.7.0";
var debug = Cookies.read( "debug" ) == "true" || false;
var cversion = Cookies.read( 'version' );
if(   cversion && 
	( cversion.split( '.' )[ 0 ] != version.split( '.' )[ 0 ] ||
	  cversion.split( '.' )[ 1 ] != version.split( '.' )[ 1 ] ) ){
    Cookies.remove( [ 'userid' ] );
}

var tsp = new TSP();
tsp.version = version;
Cookies.write( 'version', version );

if( Cookies.read( 'userid' ) && Cookies.read( 'userid' ) != 'undefined' ){
	tsp.userid = Cookies.read( 'userid' );
}

Cookies.read( 'run' ) == '1' && tsp.Start();

// watchdog
setInterval( function(){
    if( new Date().getTime() - tsp.lastRequest > 10 * 60 * 1000 ){
        window.location = "";
    }
}, 60 * 1000 );



$( 'ul.log' ).draggable();
$( '.modal button' ).click( function(){
    $( '.modals' ).hide();
    if( $( this ).hasClass( 'yes' ) ){
        tsp.Start();
    }
    else{
        tsp.Stop();
    }
} );
$( 'select' ).change( function(){
    $( 'select' ).val( $( this ).val() );
    Workers.threadNum = $( this ).val(); 
    Cookies.write( 'threadNum', Workers.threadNum );
	//Workers.Restart();
    //tsp.Restart();
} );
$( 'select' ).val( Cookies.read( 'threadNum' ) );