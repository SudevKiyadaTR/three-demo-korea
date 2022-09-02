import * as THREE from 'three';
import * as POSTPROCESSING from 'postprocessing';

import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';


const bgColor = 0x000000;
const sunColor = 0xffee00;
const screenSpacePosition = new THREE.Vector3();
const clipPosition = new THREE.Vector3();
const postprocessing = { enabled: true };
let scene, camera, renderer;
let land, earth, sun, composer, controls;
let lineCurve, lineGeometry, parent, splineCamera, cameraHelper, cameraEye;
let points = [];
let helper;
let incrementer = 1;
let lookat = new THREE.Vector3();
let currentPosition = 0;
let materialDepth = new THREE.MeshDepthMaterial();
let q = new THREE.Quaternion();

let clock = new THREE.Clock();

let d = 0;
const skyColor = new THREE.Color(0x000000);
const skyBlue = new THREE.Color(0x05a3fe);
const skyBlack = new THREE.Color(0x000000);

// Use a smaller size for some of the god-ray render targets for better performance.
const godrayRenderTargetResolutionMultiplier = 1.0 / 4.0;

class App {

	init() {

		scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000);

    camera = new THREE.PerspectiveCamera( 75, window.innerWidth / window.innerHeight, 0.001, 151000);

    camera.position.set(0, 0.01, 0);
    
    const light = new THREE.AmbientLight( 0x404040, 5 ); // soft white light
    scene.add( light );

    let directionalLight = new THREE.DirectionalLight(0xffccaa,3);
    directionalLight.position.set(0,0,-1);
    scene.add(directionalLight);

    const material = new THREE.LineBasicMaterial({
        color: 0x0000ff
    });

    const point1 = [0, 0, 0]; // Point 1 coordinates
    const point2 = [100, 0, 0]; // Point 2 coordinates
    const controlPoint = [0, 624, 0]; // Control point coordinates

    // Create a 3D quadratic Bezier curve
    lineCurve = new THREE.QuadraticBezierCurve3(
    new THREE.Vector3(point1[0], point1[1], point1[2]),
    new THREE.Vector3(controlPoint[0], controlPoint[1], controlPoint[2]),
    new THREE.Vector3(point2[0], point2[1], point2[2])
    );

    const divisions = 1000; // Number of segments of the curve
    points = lineCurve.getPoints(divisions); // Return the number of segments + 1 point, such as points The length is 31

    // Create Geometry
    lineGeometry = new THREE.BufferGeometry().setFromPoints(points);
    // geometry.vertices = points; // Assign the point list obtained in the previous step to the vertices attribute of geometry

    // Generate material
    const lineMaterial = new THREE.LineBasicMaterial( {
        color: 0xffffff,
        linewidth: 10,
        linecap: 'round', //ignored by WebGLRenderer
        linejoin:  'round' //ignored by WebGLRenderer
    } );

    const mesh = new THREE.Line(lineGeometry, lineMaterial);
    scene.add( mesh );

    let tempGeo = new THREE.SphereGeometry(2, 32, 16);
    let tempMaterial = new THREE.MeshBasicMaterial({color: 0xff0000});
    helper = new THREE.Mesh(tempGeo, tempMaterial);
    helper.position.set( new THREE.Vector3(points[0]) );
    scene.add(helper);

    // var envmap = new RGBELoader().load( "./assets/studio_small_06_4k.hdr" );
    // scene.environment = envmap;

    const manager = new THREE.LoadingManager();
    manager.onStart = function ( url, itemsLoaded, itemsTotal ) {
        console.log( 'Started loading file: ' + url + '.\nLoaded ' + itemsLoaded + ' of ' + itemsTotal + ' files.' );
    };

    manager.onLoad = function ( ) {
        console.log( 'Loading complete!');
        animate();

        window.onwheel = function(event) {
            if(event.deltaY > 0)
                renderCamera(1);
            else
                renderCamera(-1);
        };
    };


    manager.onProgress = function ( url, itemsLoaded, itemsTotal ) {
        console.log( 'Loading file: ' + url + '.\nLoaded ' + itemsLoaded + ' of ' + itemsTotal + ' files.' );
    };

    manager.onError = function ( url ) {
        console.log( 'There was an error loading ' + url );
    };

    // Instantiate a loader
    const loader = new GLTFLoader(manager);

    // Load a glTF resource
    loader.load(
        // resource URL
        './models/earth.glb',
        // called when the resource is loaded
        function ( gltf ) {

            earth = gltf.scene;

            earth.scale.set(1, 1, 1);
            earth.position.set(0, -1200/2, 0);
            let earthPARAMS = {
                x: 5.33,
                y: 3.82,
                z: 4.92
            };
            earth.rotation.set(earthPARAMS.x, earthPARAMS.y, earthPARAMS.z);
            scene.add( earth );

            earth.visible = false;

        },
        // called while loading is progressing
        function ( xhr ) {

            // console.log( ( xhr.loaded / xhr.total * 100 ) + '% loaded' );

        },
        // called when loading has errors
        function ( error ) {

            console.log( 'An error happened' );

        }
    );

    // Load a glTF resource
    loader.load(
        // resource URL
        './models/iss.glb',
        // called when the resource is loaded
        function ( gltf ) {

            let iss = gltf.scene;

            iss.scale.set(1, 1, 1);
            iss.position.set(0, 40, 20);
            scene.add( iss );

        },
        // called while loading is progressing
        function ( xhr ) {

            // console.log( ( xhr.loaded / xhr.total * 100 ) + '% loaded' );

        },
        // called when loading has errors
        function ( error ) {

            console.log( 'An error happened' );

        }
    );

    // Load a glTF resource
    loader.load(
        // resource URL
        './models/land.glb',
        // called when the resource is loaded
        function ( gltf ) {

            land = gltf.scene;

            land.position.set(0, 0, 0);
            land.scale.set(1, 1, 1);
            scene.add( land );

        },
        // called while loading is progressing
        function ( xhr ) {

            // console.log( ( xhr.loaded / xhr.total * 100 ) + '% loaded' );

        },
        // called when loading has errors
        function ( error ) {

            console.log( 'An error happened' );

        }
    );

    let circleGeo = new THREE.CircleGeometry(220,50);
    let circleMat = new THREE.MeshBasicMaterial({color: 0xffccaa});
    let circle = new THREE.Mesh(circleGeo, circleMat);
    circle.position.set(1500 , 500 ,-1500);
    circle.scale.setX(1.2);
    scene.add(circle);

    renderer = new THREE.WebGLRenderer({
        powerPreference: "high-performance",
        antialias: false,
        stencil: false,
        depth: false
    });
    renderer.toneMappingExposure = Math.pow(0.7, 5.0);
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.setSize( window.innerWidth, window.innerHeight );
    renderer.autoClear = false;
    renderer.setClearColor( 0xffffff );
    renderer.setPixelRatio( window.devicePixelRatio );
    document.body.appendChild( renderer.domElement );

    // controls = new OrbitControls( camera, renderer.domElement );
    // controls.enablePan = false;
    // controls.enableZoom = false;
    // controls.maxDistance = 1200;
    // controls.update();

    // controls = new FirstPersonControls( camera);
    // controls.lookSpeed = 0.05;
    // controls.movementSpeed = 0;

    let godraysEffect = new POSTPROCESSING.GodRaysEffect(camera, circle,{
        resolutionScale: 1,
        density: 0.9,
        decay: 0.95,
        weight: 0.9,
        samples: 300
    });

    let renderPass = new POSTPROCESSING.RenderPass(scene, camera);
    let effectPass = new POSTPROCESSING.EffectPass(camera, godraysEffect);
    effectPass.renderToScreen = true;

    composer = new POSTPROCESSING.EffectComposer(renderer);
    composer.addPass(renderPass);
    composer.addPass(effectPass);
	}

}

function onWindowResize() {

	camera.aspect = window.innerWidth / window.innerHeight;
	camera.updateProjectionMatrix();

	renderer.setSize( window.innerWidth, window.innerHeight );

}

function animate() {
    composer.render(0.1);

    requestAnimationFrame(animate);

    // renderCamera(1);

    let dist = land.position.distanceTo(camera.position);
    skyColorTransition(dist);
}

function skyColorTransition(dist) {
    d = THREE.MathUtils.mapLinear(dist, 5, 300, 0, 1);
    scene.background = skyColor.lerpColors(skyBlue, skyBlack, d);

    if(dist > 100)
        earth.visible = true;
    else
        earth.visible = false;
}

function renderCamera(n) {

    if((currentPosition < (0.1 * points.length)) || (currentPosition > 0.9 * points.length))
        incrementer = 5 * n;
    else
        incrementer = 5 * n;

    let tx = points[currentPosition].x;
    let ty = points[currentPosition].y;
    let tz = points[currentPosition].z;
    helper.position.set(tx, ty, tz);

    camera.position.set(tx, ty, tz);

    if(currentPosition < (points.length - 6))
        camera.lookAt(points[currentPosition + 1].x, points[currentPosition + 1].y, points[currentPosition + 1].z);

    currentPosition = THREE.MathUtils.clamp((currentPosition + incrementer) % points.length, 0, points.length - 1);

    tx = points[currentPosition].x;
    ty = points[currentPosition].y;
    tz = points[currentPosition].z;
}

function renderChange(wx, hy) {
    let rx = THREE.MathUtils.lerp(Math.PI / 6, -Math.PI / 6, wx);
    let ry = THREE.MathUtils.lerp(Math.PI / 6, -Math.PI / 6, hy);

    // if(wx != null)
    //     q.setFromAxisAngle( new THREE.Vector3( 0, 1, 0 ), rx );
    // else
    //     q.setFromAxisAngle( new THREE.Vector3( 0, 1, 0 ), PARAMS.y );
    // camera.applyQuaternion(q);

    // if(hy != null)
    //     q.setFromAxisAngle( new THREE.Vector3( 1, 0, -1 ), ry );
    // else
    //     q.setFromAxisAngle( new THREE.Vector3( 1, 0, -1 ), PARAMS.y );
    // camera.applyQuaternion(q);

    camera.setRotationFromAxisAngle(new THREE.Vector3(1, 0, 0), ry);
    camera.setRotationFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI * 1.25 + rx);
}

export default App;
