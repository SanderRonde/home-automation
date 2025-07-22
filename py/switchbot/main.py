import asyncio
import os
import sys
import json
from asyncio import StreamReader, StreamWriter
import switchbot
from switchbot.discovery import GetSwitchbotDevices
from switchbot.devices import curtain
import typing


class SwitchBotController:
    def __init__(self, writer: StreamWriter):
        self.devices: typing.Dict[str, typing.Any] = {}
        self.writer = writer

    async def initialize(self):
        # Discover devices
        print("Scanning for devices...")
        devices: typing.Dict[str, switchbot.models.SwitchBotAdvertisement] = (
            await GetSwitchbotDevices().discover()
        )
        print("Devices found:")
        for device in devices.values():
            if device.data.get("modelName") == switchbot.SwitchbotModel.CURTAIN:
                curtain_instance = curtain.SwitchbotCurtain(device.device)
                self.devices[device.address] = curtain_instance
        for mac_address, device in self.devices.items():
            asyncio.create_task(self._monitor_device(mac_address, device))

    async def _monitor_device(self, mac_address: str, device: typing.Any):
        """Monitor a single device with periodic updates."""
        while True:
            await device.update()

            if isinstance(device, curtain.SwitchbotCurtain):
                basic_info = await device.get_basic_info()
                if not basic_info:
                    continue
                position = basic_info.get("position")
                message = {"mac": mac_address, "position": position}
                self.writer.write(f"{json.dumps(message)}\n".encode())
                await self.writer.drain()

            await asyncio.sleep(30)  # Update every 30 seconds

    async def handle_command(self, command_str: str):
        try:
            command = json.loads(command_str)
            mac_address = command["mac"]
            action = command["action"]

            device = self.devices.get(mac_address)
            if device is None:
                return json.dumps({"error": f"Device {mac_address} not found"})

            if action.lower() == "open":
                if isinstance(device, curtain.SwitchbotCurtain):
                    await device.open()
                    return json.dumps({"success": True})
                else:
                    return json.dumps(
                        {"error": f"Device {mac_address} is not a curtain"}
                    )
            elif action.lower() == "close":
                if isinstance(device, curtain.SwitchbotCurtain):
                    await device.close()
                    return json.dumps({"success": True})
                else:
                    return json.dumps(
                        {"error": f"Device {mac_address} is not a curtain"}
                    )
            else:
                return json.dumps({"error": f"Unknown command {action}"})
        except json.JSONDecodeError:
            return json.dumps({"error": "Invalid JSON format"})
        except KeyError as e:
            return json.dumps({"error": f"Missing required field: {str(e)}"})


async def handle_client(reader: StreamReader, writer: StreamWriter):
    """Handle individual client connections."""
    peer = writer.get_extra_info("peername")
    print(f"New connection from {peer}")

    controller = SwitchBotController(writer)
    await controller.initialize()

    try:
        while True:
            data = await reader.readline()
            if not data:
                break

            message = data.decode().strip()
            print(f"Received command: {message}")

            result = await controller.handle_command(message)
            if result:
                writer.write(f"{result}\n".encode())
                await writer.drain()

    except Exception as e:
        print(f"Error handling client: {e}")
    finally:
        print("Closing!!!")
        writer.close()
        await writer.wait_closed()
        print(f"Connection closed for {peer}")


async def main():
    # Get path relative to this file's parent directory
    current_dir = os.path.dirname(os.path.abspath(__file__))
    parent_dir = os.path.dirname(current_dir)
    SOCKET_PATH = os.path.join(parent_dir, sys.argv[1])

    # Remove existing socket file if it exists
    if os.path.exists(SOCKET_PATH):
        os.unlink(SOCKET_PATH)

    # Create the server
    server = await asyncio.start_unix_server(handle_client, path=SOCKET_PATH)

    print(f"SwitchBot controller listening on {SOCKET_PATH}")

    async with server:
        await server.serve_forever()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\nShutting down...")
        current_dir = os.path.dirname(os.path.abspath(__file__))
        parent_dir = os.path.dirname(current_dir)
        SOCKET_PATH = os.path.join(parent_dir, sys.argv[1])
        if os.path.exists(SOCKET_PATH):
            os.unlink(SOCKET_PATH)
        sys.exit(0)
