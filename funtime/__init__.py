#!/usr/bin/env python3
from __future__ import print_function
from rich.console import Console
from rich.syntax import Syntax
import frida, sys, argparse, json, datetime
console = Console()

def main():
    parser = argparse.ArgumentParser(description='funtime: Objective-C runtime tracing')
    parser.add_argument('-s', '--spawn', action='store_true', help='spawn process')
    parser.add_argument('-U', '--usb', action='store_true', help='use usb device')
    parser.add_argument('-b', '--backtrace', action='store_true', help='display backtrace (slow)')
    parser.add_argument('-n', '--name', required=True, type=str, help='name of process or pid')
    parser.add_argument('-t', '--theme', type=str, help='display theme', default="one-dark")
    parser.add_argument('-c', '--bgcolor', type=str, help='background color', default="black")
    parser.add_argument('-l', '--script', type=str, help='load an additional script', default="")
    parser.add_argument('methods', metavar='SEL', type=str, nargs='+',
                        help='a method selector like "*[NSMutable* initWith*]"')

    args = parser.parse_args()

    device = frida.get_local_device()
    if args.usb:
        device = frida.get_usb_device()

    name = args.name 
    if name.isdigit():
        name = int(name)

    if args.spawn:
        session = device.spawn(name)
    else:
        session = device.attach(name)

    print(f"Attached to {name} on {device}")

    try:
        js = open(__file__.replace("__init__.py", "funtime.js")).read()
        script = session.create_script(js)

        if args.script != "":
            session.create_script(open(args.script).read()).load()

        def format_call(info):
            if len(info["args"]) == 0: return "" # idk how this is happening

            obj = info["args"][0]
            parts = info["targetMethod"].split(":")
            objstr = f"""({obj["typeDescription"]})( {obj["objectDescription"]} )"""
            if info["targetType"] == "+":
                objstr = obj["typeDescription"].split(" ")[0]

            formatted = "\n\t" + f"""{info["targetType"]}[{objstr} """.replace("\n", "\n\t")

            if len(parts) == 1:
                formatted += "\n\t\t" + parts[0]
            else:
                for i, arg in enumerate(info["args"][2:]):
                    formatted += ("\n\t\t" + f"""{parts[i]}: ({arg["typeDescription"]})""" + 
                        f"""( {arg["objectDescription"]} )""".replace("\n", "\n\t\t"))

            formatted += "];\n\t"

            if info["retTypeDescription"] != "void":
                formatted += (f"""return ({info["retTypeDescription"]})""" + 
                    f"""( {info["returnDescription"]} );""".replace("\n", "\n\t\t"))

            if "backtrace" in info:
                sep = "\n\t\t"
                bt = [str(b.get("address", "---")) + " : " + str(b.get("name", "---")) 
                    for b in info["backtrace"]]
                    
                formatted += f"""\n\t/* backtrace:\n\t\t{sep.join(bt)}\n\t*/"""
                
            return formatted + f" // {datetime.datetime.now().isoformat()}"

        def on_message(message, data):
            if "payload" in message:
                payload = json.loads(message["payload"])
                formatted = format_call(payload)
                console.print(Syntax(formatted, "objc", theme=args.theme, background_color=args.bgcolor))

        script.on('message', on_message)
        script.load()

        for method in args.methods:
            try:
                script.exports_sync.hook(method, args.backtrace)
            except Exception as e:
                print("error", e)

        sys.stdin.read()
    except KeyboardInterrupt:
        pass

    # script.unload()
    session.detach()

if __name__ == "__main__":
    main()