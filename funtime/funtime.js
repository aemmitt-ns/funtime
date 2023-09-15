const typeMap = {
    "c": "char",
    "i": "int",
    "s": "short",
    "l": "long",
    "q": "long long",
    "C": "unsigned char",
    "I": "unsigned int",
    "S": "unsigned short",
    "L": "unsigned long",
    "Q": "unsigned long long",
    "f": "float",
    "d": "double",
    "B": "bool",
    "v": "void",
    "*": "char *",
    "@": "id",
    "#": "Class",
    ":": "SEL",
    "[": "Array",
    "{": "struct",
    "(": "union",
    "b": "Bitfield",
    "^": "*",
    "r": "char *", // i don't understand r
    "?": "void *" // just so it works
};

const descMap = {
    "Protocol": (obj) => {
        return "/* " + obj.description() + " " + obj.name() + " */ " + ptr(obj);
    },
    "NSString": (obj) => {
        return '@"' + obj.description() + '"';
    },
    // remove this if its causing slowdowns
    "NSData": (obj) => {
        if (obj.length() == 0) {
            return "/* " + obj.description() + " */ " + ptr(obj);
        }
        let desc = "/* " + obj.description() + "\n";
        let len = obj.length();
        if (len > 0x1000) {
            len = 0x1000;
        }
        return desc + hexdump(obj.bytes(), {length: len}) + "\n*/ " + ptr(obj);
    },
    "NSArray": (obj) => {
        return "/* " + obj.description() + " */ " + ptr(obj);
    },
    "NSXPCDecoder": (obj) => {
        return "/* " + obj.description() + " */ " + ptr(obj);
    },
    "NSMethodSignature": (obj) => {
        return "/* " + obj._typeString() + " */ " + ptr(obj);
    }
};

const descCache = {};

function getClassName(obj) {
    const object = new ObjC.Object(obj);
    if (object.$methods.indexOf("- className") != -1) {
        return object.className();
    } else {
        return "id";
    }
}

function getDescription(object) {
    const klass = object.class();
    const name = "" + object.className();
    if (!descCache[name]) {
        const klasses = Object.keys(descMap);
        for(let i = 0; i < klasses.length; i++) {
            let k = klasses[i];
            if (klass["+ isSubclassOfClass:"](ObjC.classes[k])) {
                descCache[name] = k;
                return descMap[k](object);
            }
        }
    } else if (descCache[name] != "") {
        return descMap[descCache[name]](object);
    }
    descCache[name] = "";
    //if (object.$methods.indexOf("- description") != -1) {
    if (globalThis.debugDesc && object.respondsToSelector_(ObjC.selector("debugDescription"))) {
        return "/* " + object.debugDescription() + " */ " + ptr(object);
    } else if (object.respondsToSelector_(ObjC.selector("description"))) {
        return "/* " + object.description() + " */ " + ptr(object);
    } else {
        return "" + ptr(object);
    }
}

function typeDescription(t, obj) {
    if (t != "@") {
        let pre = ""
        let post = "";
        let nt = t;
        if (t[0] == "^") {
            nt = t.substring(1);
            post = " *";
        }
        if (t.includes("{")) {
            pre = "/* " + t + " */ ";
        }
        return pre + typeMap[nt[0]] + post;
    } else {
        if (!obj.isNull()) {
            return getClassName(obj) + " *";
        }
        return "id *";
    }
}

function objectDescription(t, obj) {
    if (obj.isNull()) {
        return "0";
    } else if (t[0] == "^") {
        let pre = "/* (*" + obj + ") -> */ ";
        return pre + objectDescription(t.substring(1), obj.readPointer()); 
    } else if (t == "@") {
        const object = new ObjC.Object(obj);
        return getDescription(object);
    } else if (t == "#") {
        const object = new ObjC.Object(obj);
        return "/* " + obj + " */ " + object.description();
    } else if (t == ":") {
        // const object = new ObjC.Object(obj);
        const description = "" + obj.readCString(); 
        return "/* " + description + " */ " + obj;
    } else if (t == "*" || t == "r*") {
        return '"' + obj.readCString() + '"';
    } else if ("ilsILS".indexOf(t) != -1) {
        return "" + obj.toInt32();
    } else {
        return "" + obj;
    }
}

const hookMethods = (selector, showBacktrace) => {
    if(ObjC.available) {
        const resolver = new ApiResolver('objc');
        const matches = resolver.enumerateMatches(selector);

        if (matches.length == 0) {
            console.warn(`No methods matched: ${selector}`);
        }

        matches.forEach(m => {
            const name = m.name;
            const t = name[0];
            const klass = name.substring(2, name.length-1).split(" ")[0];
            const method = name.substring(2, name.length-1).split(" ")[1];
            const mparts = method.split(":");

            try {
                Interceptor.attach(m.address, {
                    onEnter(args)  {
                        const obj = new ObjC.Object(args[0]);
                        const sel = args[1];
                        const sig = obj["- methodSignatureForSelector:"](sel);
                        this.invocation = null;

                        if (sig !== null) {
                            this.invocation = {
                                "targetType": t,
                                "targetClass": klass,
                                "targetMethod": method,
                                "args": []
                            };

                            const nargs = sig["- numberOfArguments"]();
                            this.invocation.returnType = sig["- methodReturnType"]();
                            for(let i = 0; i < nargs; i++) {
                                const argtype = sig["- getArgumentTypeAtIndex:"](i);
                                this.invocation.args.push({
                                    "typeString": argtype,
                                    "typeDescription": typeDescription(argtype, args[i]),
                                    "object": args[i],
                                    "objectDescription": objectDescription(argtype, args[i])
                                });
                            }
                        }
                        if (showBacktrace) {
                            const bt = Thread.backtrace(this.context, Backtracer.ACCURATE);
                            this.invocation.backtrace = bt.map(DebugSymbol.fromAddress);
                        }
                    },
                    onLeave(ret) {
                        if (this.invocation !== null) {
                            this.invocation.retTypeDescription = typeDescription(this.invocation.returnType, ret);
                            this.invocation.returnDescription = objectDescription(this.invocation.returnType, ret);
                            send(JSON.stringify(this.invocation));
                        }
                    }
                });
            } catch (err) {
                // sometimes it cant hook copyWithZone? dunno but its not good to hook it anyway.
                if (method != "copyWithZone:") {
                    console.error(`Could not hook [${klass} ${method}] : ${err}`);
                }
            }
        });
    } else {
        console.error(`Could not find the ObjC runtime`);
    }
}

rpc.exports.hook = hookMethods;
globalThis.debugDesc = true; // use debugDescription
