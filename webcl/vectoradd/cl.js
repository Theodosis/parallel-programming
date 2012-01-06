function loadKernel( id ){
    var KernelElement = document.getElementById( id );
    var KernelSource = KernelElement.text;
    if( KernelElement.src != '' ){
        var mHttpReq = new XMLHttpRequest();
        mHttpReq.open( "GET", KernelElement.src, false );
        mHttpReq.send( null );
        KernelSource = mHttpReq.responseText;
    }
    return KernelSource;
}

function init(){
    window.output = document.getElementById( 'output' );
    var vectorLength = 10000000;
    output.innerHTML += "<br />Vector length = " + vectorLength;
   
    
    var UIvector1 = new Uint32Array( vectorLength );
    var UIvector2 = new Uint32Array( vectorLength );
    var outBuffer = new Uint32Array( vectorLength );
    for( var i = 0; i < vectorLength; ++i ){
        UIvector1[ i ] = Math.floor( Math.random() * 100 );
        UIvector2[ i ] = Math.floor( Math.random() * 100 );
    }
    
    var before = ( new Date ).getTime();
    outBuffer = CL_vectorAdd( UIvector1, UIvector2, vectorLength );
    console.log( outBuffer );
    var after = ( new Date ).getTime();
    output.innerHTML += "<br /> kernel time: " + ( after - before );
    
    var before = ( new Date ).getTime();
    outBuffer = vectorAdd( UIvector1, UIvector2, vectorLength );
    console.log( outBuffer );
    var after = ( new Date ).getTime();
    output.innerHTML += "<br /> js time: " + ( after - before );

    //asynchronous execution
    //WK_vectorAdd( UIvector1, UIvector2, vectorLength );
}

function CL_vectorAdd( UIvector1, UIvector2, vectorLength ){
    var platforms = WebCL.getPlatformIDs();
    var ctx = WebCL.createContextFromType( [ WebCL.CL_CONTEXT_PLATFORM , platforms[ 0 ] ], WebCL.CL_DEVICE_TYPE_DEFAULT );

    var bufSize = vectorLength * 4; //in bytes

    var bufIn1 = ctx.createBuffer( WebCL.CL_MEM_READ_ONLY, bufSize );
    var bufIn2 = ctx.createBuffer( WebCL.CL_MEM_READ_ONLY, bufSize );
    var bufOut = ctx.createBuffer( WebCL.CL_MEM_WRITE_ONLY, bufSize );

    var KernelSrc = loadKernel( 'clVectorAdd' );
    var program = ctx.createProgramWithSource( KernelSrc );
    var devices = ctx.getContextInfo( WebCL.CL_CONTEXT_DEVICES );
    try{
        program.buildProgram( [ devices[ 0 ] ], "" );
    } catch( e ){
        alert( "Error" );
    }

    var kernel = program.createKernel( "ckVectorAdd" ); //kernel name from clVectorAdd.cl
    kernel.setKernelArg( 0, bufIn1 );
    kernel.setKernelArg( 1, bufIn2 );
    kernel.setKernelArg( 2, bufOut );
    kernel.setKernelArg( 3, vectorLength, WebCL.types.UINT );

    var cmdQueue = ctx.createCommandQueue( devices[ 0 ], 0 );
    var dataObject1 = WebCL.createDataObject();
    dataObject1.allocate( bufSize );
    dataObject1.set( UIvector1 );

    var dataObject2 = WebCL.createDataObject();
    dataObject2.allocate( bufSize );
    dataObject2.set( UIvector2 );

    cmdQueue.enqueueWriteBuffer( bufIn1, false, 0, dataObject1.length, dataObject1, [] );
    cmdQueue.enqueueWriteBuffer( bufIn2, false, 0, dataObject2.length, dataObject2, [] );

    var localWS = [ 8 ];
    var globalWS = [ Math.ceil( vectorLength / localWS ) * localWS ];

    cmdQueue.enqueueNDRangeKernel( kernel, globalWS.length, [], globalWS, localWS, [] );
    cmdQueue.enqueueReadBuffer( bufOut, false, 0, bufSize, dataObject1, [] );
    cmdQueue.finish();

    outBuffer = new Uint32Array( vectorLength );
    var utils = WebCL.getUtils();
    utils.writeDataObjectToTypedArray( dataObject1, outBuffer );
    
return outBuffer;
}

function vectorAdd( v1, v2, vectorLength ){
    var o = new Uint32Array( vectorLength );
    for( var i = 0; i < vectorLength; ++i ){
        o[ i ] = v1[ i ] + v2[ i ];
    }
    return o;
}

function chunk(a, s){
    for(var x, i = 0, c = -1, l = a.length, n = []; i < l; i++)
        (x = i % s) ? n[c][x] = a[i] : n[++c] = [a[i]];
    return n;
}
function WK_vectorAdd( v1, v2, vectorLength ){
    var before = ( new Date ).getTime();
    var countworkers = 10;
    var workers = [];
    var count = 0;
    v1 = chunk( v1, vectorLength / countworkers );
    v2 = chunk( v2, vectorLength / countworkers );
    for( i = 0; i < countworkers; ++i ){
        workers[ i ] = new Worker( 'worker.js' );
        workers[ i ].postMessage( JSON.stringify( {
            "v1":v1,
            "v2":v2,
            "vectorLength":vectorLength / countworkers
        } ) );
        workers[ i ].onmessage = function( event ){
            ++count;
            console.log( count );
            console.log( countworkers );
            if( count == countworkers ){
                after = ( new Date ).getTime();
                output.innerHTML += "<br />Workers time: " + ( after - before ) + "ms";
            }
        }
    }
}

init();
