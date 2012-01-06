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

function setupCanvas(){
    var canvas = document.getElementById( 'canvasImg' );
    var ctx = canvas.getContext( "2d" );
    var img = document.getElementById( 'srcimg' );
    canvas.width = img.width;
    canvas.height = img.height;
    ctx.drawImage( img, 0, 0, img.width, img.height );
}

function CL_desaturate(){
    var before = ( new Date ).getTime();
    var output = document.getElementById( 'output' );
    output.innerHTML = "";

    
    var canvasImg = document.getElementById("canvasImg");
    var canvasImgCtx = canvasImg.getContext("2d");
    var width = canvasImg.width;
    var height = canvasImg.height;
    var pixels = canvasImgCtx.getImageData(0, 0, width, height);

    // Dimm the existing canvas to highlight any errors we might get.
    // This does not affect the already retrieved pixel data.
    //canvasImgCtx.fillStyle = "rgba(0,0,0,0.7)";
    //canvasImgCtx.fillRect(0, 0, width, height);
    
    // Setup WebCL context using the default device of the first available 
    // platform
    var platforms = WebCL.getPlatformIDs();     
    var ctx = WebCL.createContextFromType ([WebCL.CL_CONTEXT_PLATFORM, 
                                           platforms[0]],
                                           WebCL.CL_DEVICE_TYPE_DEFAULT);

    // Setup buffers
    var imgSize = width * height;
    output.innerHTML += "<br>Image size: " + imgSize + " pixels ("
                     + width + " x " + height + ")";
    var bufSize = imgSize * 4; // size in bytes
    output.innerHTML += "<br>Buffer size: " + bufSize + " bytes";
    
    var bufIn = ctx.createBuffer (WebCL.CL_MEM_READ_ONLY, bufSize);
    var bufOut = ctx.createBuffer (WebCL.CL_MEM_WRITE_ONLY, bufSize);

     // Create and build program
    var kernelSrc = loadKernel("clDesaturate");
    var program = ctx.createProgramWithSource(kernelSrc);
    var devices = ctx.getContextInfo(WebCL.CL_CONTEXT_DEVICES);
    try {
      program.buildProgram ([devices[0]], "");
    } catch(e) {
      alert ("Failed to build WebCL program. Error "
             + program.getProgramBuildInfo (devices[0], 
                                            WebCL.CL_PROGRAM_BUILD_STATUS)
             + ":  " + program.getProgramBuildInfo (devices[0], 
                                                    WebCL.CL_PROGRAM_BUILD_LOG));
      throw e;
    }

    // Create kernel and set arguments
    var kernel = program.createKernel ("clDesaturate");
    kernel.setKernelArg (0, bufIn);
    kernel.setKernelArg (1, bufOut);
    kernel.setKernelArg (2, width, WebCL.types.UINT);
    kernel.setKernelArg (3, height, WebCL.types.UINT);

    // Create command queue using the first available device
    var cmdQueue = ctx.createCommandQueue (devices[0], 0);

    // Write the buffer to OpenCL device memory
    var dataObject = WebCL.createDataObject ();
    dataObject.allocate(bufSize);
    dataObject.set (pixels.data);
    cmdQueue.enqueueWriteBuffer (bufIn, false, 0, dataObject.length, 
                                 dataObject, []);

    // Init ND-range 
    var localWS = [16,4];  
    var globalWS = [Math.ceil (width / localWS[0]) * localWS[0], 
                    Math.ceil (height / localWS[1]) * localWS[1]];
    
    output.innerHTML += "<br>work group dimensions: " + globalWS.length;
    for (var i = 0; i < globalWS.length; ++i)
      output.innerHTML += "<br>global work item size[" + i + "]: " + globalWS[i];
    for (var i = 0; i < localWS.length; ++i)
      output.innerHTML += "<br>local work item size[" + i + "]: " + localWS[i];
    
    // Execute (enqueue) kernel
    cmdQueue.enqueueNDRangeKernel(kernel, globalWS.length, [], 
                                  globalWS, localWS, []);

    // Read the result buffer from OpenCL device
    cmdQueue.enqueueReadBuffer (bufOut, false, 0, 
                                pixels.data.length, dataObject, []);
    cmdQueue.finish (); //Finish all the operations
    
    var utils = WebCL.getUtils ();
    utils.writeDataObjectToTypedArray (dataObject, pixels.data);
    canvasImgCtx.putImageData (pixels, 0, 0);

    output.innerHTML += "<br>Done.";
    output.innerHTML += "<br /> time: " + ( ( new Date ).getTime() - before ) + "ms";
}  
