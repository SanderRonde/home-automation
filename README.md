# home-automation

A locally hosted home automation server that automates various things. Currently consists of remote device control (lamps, speakers etc), a script runner, a remote media controller and a detector for who's home. Tightly integrated to, for example, turn off the lights when I leave. Tied together by a web app, touch screen, telegram bot and smart device (Google Home) APIs, allowing for simple control from anywhere in any way.

A large part of this project consists of the smart controllers that are to be controlled. This part is done with microcontrollers, consisting of Arduinos (Uno and Due) and various boards with the ESP8266 WiFi chip. These are programmed in C/C++ to interface with the server. See [How it works](#How-it-works) for more info on that.

Backend consists of a NodeJS server running express, using the web and the [serialport](https://www.npmjs.com/package/serialport) and [magic-home](https://www.npmjs.com/package/magic-home) packages to interface with microcontrollers and the [castv2-player](https://www.npmjs.com/package/castv2-player) package to interface with cast-enabled devices (google home). The frontend uses [wc-lib](https://github.com/SanderRonde/wc-lib), a webcomponent-based web framework that just so happens to be made by me as well.

**Note: This project is personalized to me and as such is very unlikely to suit your needs or to even compile successfully (missing secrets and config files). Please feel free to copy and use any code you'd like but keep this in mind.**

## Features

### Modules

#### KeyVal

The keyval module controls the state of various devices, allowing you to turn on or off devices. It also supports some other features like toggling and listening for changes over websockets, which is mainly used to interface with the microcontrollers.

The invidvidual togglable power sockets consist of a few cheap electrical parts and an ESP8266 board that together allow for remote control of power sockets.

#### Home-detector

The home-detector module detects who is home and who isn't. This is useful for turning on or off things when someone leaves the house.

#### Cast

The cast module allows for the casting of things to cast-enabled devices. Since I only have a google home mini, it can only cast audio tracks and text-to-speech for now.

#### Temperature

The temperature module allows for the setting of a target temperature of the house. The server then tells a temperature controller what to do based on the currently measured temperature, eventually reaching the target temperature. It also allows for manual turning on and off of a temperature controller (for example for when you leave home).

#### Explain

The explain module records actions and how they occurred on top of the regular logging. This can then be used to later ask the server why it did something. Since there are quite a few input methods to this system, things sometimes occur without knowing the cause. While sifting through logs is possible, it's not a great experience. Simply saying "explain what you did" and hearing a step-by-step summary is a lot better.

#### Info-screen

The info-screen module powers a screen containing some basic info like the temperature outside and inside (thanks to the temperature module), as well as the upcoming calender events etc. It is basically an HTML page hosted on localhost that talks to the server via a separate entrypoint. In my case the actual screen is mounted behind some mirror foil to have a sort of smart-mirror.

#### Webhook

The webhook module is a fairly simple interface with the outside world. When a webhook endpoint is reached, the webhook with that name is ran. Webhooks can be configured in a config file to interface with any other module, allowing you to do anything from a webhook.

### Controllers

#### Telegram bot

Everything is connected with a telegram bot that (semi-)intelligently performs the actions you tell it to. It consists of a lot of regex but works surprisingly well.

#### Web apps

There is a web app that allows control of the keyval store for simple control of the lights and speakers from a phone.

## How it works

#### KeyVal

Consists of a simple JSON file that serves as a mini key-value database. It stores the state of all keys. States can be set through any of the controllers. State changes can be listened for through internal modules, allowing for changes to be handled in a number of ways. The most used one is the communicating with power controlling switches through a sort of makeshift websockets implementation.

The power controlling switches are made out of a couple of components. The first thing is any development board that is powered by the ESP8266 chip (generally a NodeMCU board). This board controls a relay whose terminals are connected to stripped 220v power cables. Both the relay and board are powered by a 5v power adapter. The relay's output terminal and the ground are then connected to a female power socket, allowing any plug put in it to be remotely powered. In total these components cost around 7 euros on ebay.

The board runs C/C++ code which can be found over at the [board-power-driver repository](https://github.com/SanderRonde/board-power-driver). Since these boards can use neither long polling nor websockets (some of them can but not all), a sort of makeshift websockets protocol was made. It connects to the server and tells it its own IP address. The server then sends messages directly to that IP address. Of course this only works over a local network but it works surprisingly well.

When a keyval value changes, a listener is fired which then sends the changed value to the responsible board over the makeshift websockets. The board then changes the state of the data pin of the relay, after which the power goes on or off.

#### Home-detector

The home detector constantly pings given IP addresses and checks if any response is given. When a response is not given for a certain amount of time, the device that the IP address belongs to is deemed off of the network and the associated configuration is triggered. Check `app/server/config_examples/home-hooks.ts` for an example. Through the use of interfaces from other modules, other modules can easily be triggered.

#### Cast

The cast module works by casting the audio file returned by google translate's text to speech engine to a cast-enabled device.

#### Scripts

Scripts work by simply executing the file at given path. Of course this could potentially be very unsafe so some safeguards exist when it comes to path alongside the regular authentication measures.

#### Remote Control

The remote control works by sending any commands it gets to two destinations. The first one being a list of listening webbrowsers (through the [playback-control browser extension](https://github.com/SanderRonde/playback-control)) and the second one being a preconfigured list of telnet clients. The telnet client expects a VLC instance to listen at the receiving end, executing all instructions. If noone is listening, messages are simply ignored, allowing other listening instances to pick them up. For more info about how the webbrowser version works check out the repo.

#### Temperature

The temperature module works by setting a target temperature and instructing a temperature controller to either increase or decrease the temperature depending on the one that was measured. It also allows for manual turning on and off of the temperature controller. In the future something like knowing how long it takes for the home to heat up X degrees could be used to start pre-heating the home just in time before the user arrives.

The code for the microcontroller measuring the temperature can be found [over at this repository](https://github.com/SanderRonde/board-temperature-driver).

The code for the microcontroller driving it can be found [over at this repository](https://github.com/SanderRonde/board-temperature-controller-driver).

#### Explain

The explain module works by adding another layer on top of the regular logging layer. When certain actions that are deemed important are performed (for example turning off the lights or LEDs), the source of the command is stored. For example this action could have been performed through the bot, through the app or through the API. This data can later be requested and a summary of what happened in the last X minutes can be sent to telegram or read aloud using the Cast module.

#### Info-screen

The info-screen module works through some fairly simple REST API's hosted on localhost. Because it's all hosted on and only accessible from localhost, there isn't much need for complexity. Getting the temperature from inside is done through the temperature module and getting the temperature outside is done through the [openweathermap API](https://openweathermap.org/api). The upcoming calendar is fetched through google's calendar API, first requring the user to give permission to the app for their google account.

#### Webhook

The webhook module uses a simple config file, in which the webhook with given name is called when its endpoint has been hit.

#### Telegram bot

The telegram bot works by first configuring a lot of possible telegram messages and their responses. For example sending "hi" returns "hello" and asking how late it is returns the time. These possible inputs are all set up through a big list of regular expressions. When a message is received, the list is checked for any matches and it executed the ones that are found.

It can also keep track of a previous subject. For example saying "turn on the light" and then later saying "turn it off" will turn off that light. This works by storing the last subject and referring back to it.

It also allows for simple chaining through common words. For example "turn off the light and turn on leds" would do both.

#### Smart speaker integration

Smart speaker integration works by providing an HTTP endpoint for almost everything that can be done. IFTTT hooks can then be set up to send a webrequest to one of these endpoints when a given string is matched.

#### Web apps

The web apps use the [wc-lib](https://github.com/SanderRonde/wc-lib) webcomponent framework for the frontend and communicate with the server through the same endpoints as the smart speaker integration.

#### Touch screen

The touch screen is based on a nextion touch screen and a controlling arduino. The arduino listens for any touch events from the touch screen and passes those on to the server, which then sets the keyval store's values.

Check out the arduino driver for the board [over here](https://github.com/SanderRonde/arduino-board-screen-driver).

## License

```text
Copyright 2019 Sander Ronde

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
```
