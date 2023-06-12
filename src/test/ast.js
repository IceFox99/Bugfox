const a = (x) => x;

function func(a,b,c) {} // FunctionDeclaration

const arrow = (...args) => {}; // VariableDeclaration -> ArrowFunctionExpression
(x) => { return x; }

const arrow2 = function () {}; // VariableDeclaration -> FunctionExpression

const arrow3 = (x) => x * x; // same as arrow1

const [ arrow4, arrow5 ] = [ (i) => { return i; }, (j) => { return j; } ];

class C {
    constructor() {this.test();} // ClassDeclaration -> MethodDefinition -> FunctionExpression
    test() {
        function innerTest() {

        }
        innerTest();
    } // same as constructor
    arrowInside = () => {} // ClassDeclaration -> PropertyDefinition -> ArrowFunctionExpression
}

class D extends C {
    constructor() {
        super();
    }
}

let empty = () => {}, empty2 = function () { }, empty3 = 3, shit, fuck;
empty = (x) => x;
[damn, [shit, fuck]] = [()=>{},[()=>{}, ()=>{}]];
let [foo, [zoo, boo]] = [(foo)=>{}, [(zoo)=>{}, (boo)=>{}]];
