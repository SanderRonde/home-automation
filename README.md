# home-automation

A locally hosted home automation server that automates various things. Currently consists of remote device control (lamps, speakers etc), rgb effects, a script runner and a detector for who's home. Tightly integrated to, for example, turn off the lights when I leave. Tied together by a web app, touch screen, telegram bot and smart device (Google Home) APIs, allowing for simple control from anywhere in any way. 

A large part of this project consists of the smart controllers and rgb strips that are to be controlled. This part is done with microcontrollers, consisting of Arduinos (Uno and Due) and various boards with the ESP8266 WiFi chip. These are programmed in C/C++ to interface with the server. See [How it works](#How-it-works) for more info on that.

Backend consists of a NodeJS server running express, using the web and the [serialport](https://www.npmjs.com/package/serialport) and [magic-home](https://www.npmjs.com/package/magic-home) packages to interface with microcontrollers and the [castv2-player](https://www.npmjs.com/package/castv2-player) package to interface with cast-enabled devices (google home). The frontend uses [wc-lib](https://github.com/SanderRonde/wc-lib), a webcomponent-based web framework that just so happens to be made by me as well.

**Note: This project is personalized to me and as such is very unlikely to suit your needs or to even compile successfully (missing secrets and config files). Please feel free to copy and use any code you'd like but keep this in mind.**

## Features

### Modules

#### KeyVal

The keyval module controls the state of various devices, allowing you to turn on or off devices. It also supports some other features like toggling and listening for changes over websockets, which is mainly used to interface with the microcontrollers.

The invidvidual togglable power sockets consist of a few cheap electrical parts and an ESP8266 board that together allow for remote control of power sockets.

#### RGB

The RGB module controls the state of all RGB strips. Some work through [magic-home](https://www.npmjs.com/package/magic-home) and others work through individually adressable LED strips, interfaced with an arduino running a custom communication protocol. The module allows for the setting of specific colors, patterns and effects.

#### Home-detector

The home-detector module detects who is home and who isn't. This is useful for turning on or off things when someone leaves the house.

#### Cast

The cast module allows for the casting of things to cast-enabled devices. Since I only have a google home mini, it can only cast audio tracks and text-to-speech for now.

#### Scripts

The scripts module simply runs specified scripts in a pre-configured directory. This allows for shutting down the PC or booting it up when someone leaves or enters the house.

### Controllers

#### Telegram bot

Everything is conneceted with a telegram bot that (semi-)intelligently performs the actions you tell it to. It consists of a lot of regex but works surprisingly well.

#### Smart speaker integration

Smart speakers can talk to the service using the web API through IFTTT. If a given sentence is said, IFTTT sends a webrequest to the server, which then performs the action.

#### Web apps

There are two web apps. One allows control of the keyval store for simple control of the lights and speakers from a phone. The second one allows for control of RGB lights through a color wheel.

#### Touch screen

There is a touch screen using a [nextion touch screen](https://nextion.tech/). It communicates through an arduino with the server.

## How it works

#### KeyVal



## License

```text
Copyright 2019 Sander Ronde

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
```