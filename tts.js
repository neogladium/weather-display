'use strict'

const fs = require('fs')
var child_process = require('child_process')
var Ivona = require('ivona-node/')
var config = require('./config')
var Logger = require('./logger')

class TTS {

  constructor(musicPlayer){
    this.ivona = new Ivona({
      accessKey: config.ivona.accessKey,
      secretKey: config.ivona.secretKey
    })

    if (musicPlayer) this.musicPlayer = musicPlayer

    this.speaking = false
    this.processing = false

    this.voiceOptions = {
      body: {
        voice: { 
          gender: 'Female', 
          language: 'en-GB', 
          name: 'Amy' 
        },
        parameters: {
          volume: 'x-loud',
          rate: 'medium',
          sentenceBreak  : 600,
          paragraphBreak : 1200
        },
        input: {
          type: 'application/ssml+xml'
        }
      }
    }

  }

  speak(string, options) {
    if (!options) {
      options = {
        alert: true,
        bgm: true,
        volume: 7,
      }
    }
    if (this.processing || this.speaking) {
      Logger.log("Attempted to speak... I'm already speaking or processing. Abandoning.")
    } else {
      Logger.log("TTS processing: " + string.split("\n").join(''))
      this.processing = true
      this.ivona.createVoice(`<prosody rate="+10%">` + string + `</prosody>`, JSON.parse(JSON.stringify(this.voiceOptions)))
      .pipe(fs.createWriteStream('/tmp/text.mp3'))
      .on('finish', () => {
        var commands = []
        if (options.bgm || options.alert) {
          if (options.bgm) {
            commands.push('sox sounds/silence/silence1000.wav sounds/silence/silence1000.wav /tmp/text.mp3 sounds/silence/silence1500.wav sounds/silence/silence1500.wav sounds/silence/silence5000.wav /tmp/textdelay.mp3')
          } else {
            commands.push('sox sounds/silence/silence1000.wav sounds/silence/silence1000.wav /tmp/text.mp3 /tmp/textdelay.mp3')
          }
          if (options.bgm && options.alert) {
            commands.push('sox -m sounds/event/cchord.wav /tmp/textdelay.mp3 sounds/bgm/happygit.wav /tmp/new.mp3 trim 0 `soxi -D /tmp/textdelay.mp3`')
          } else if (options.alert) {
            commands.push('sox -m sounds/event/cchord.wav /tmp/textdelay.mp3 /tmp/new.mp3 trim 0 `soxi -D /tmp/textdelay.mp3`')
          } else {
            commands.push('sox -m /tmp/textdelay.mp3 sounds/bgm/happygit.wav /tmp/new.mp3 trim 0 `soxi -D /tmp/textdelay.mp3`')
          }

          if (options.bgm) {
            commands.push('sox /tmp/new.mp3 /tmp/new2.mp3 fade t 0 `soxi -D /tmp/new.mp3` 0:05')
          } else {
            commands.push('mv /tmp/new.mp3 /tmp/new2.mp3')
          }

        } else {
          commands.push('mv /tmp/text.mp3 /tmp/new2.mp3')
        }
        child_process.exec(commands.join(' && '), () => {
          this.processing = false
          Logger.log("TTS speaking: " + string.split("\n").join(''))
          this.speaking = true
          
          if (this.musicPlayer.playing) {
            this.musicPlayer.fadeDown().then(()=>{
              child_process.exec(`play /tmp/new2.mp3`, () => {
                Logger.log("TTS finished playing")
                if (this.musicPlayer.playing) this.musicPlayer.fadeUp()
                this.speaking = false
                if (options.playnews) {
                  this.musicPlayer.playPodcast(config.newsPodcastUri)
                }
              })
            })
          } else {
            child_process.exec(`play /tmp/new2.mp3`, () => {
              Logger.log("TTS finished playing")
              if (this.musicPlayer.playing) this.musicPlayer.fadeUp()
              this.speaking = false
              if (options.playnews) {
                this.musicPlayer.playPodcast(config.newsPodcastUri)
              }
            })
          }
        })
      })
    }
  }

}

module.exports = TTS