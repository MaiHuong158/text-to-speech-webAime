window.onload = init

function init() {
    var tts = new TTSPlay('vi', 1)
    var lang = 'vi'
    console.log(tts)

    function changeLang(newLang) {
        lang = newLang
    }

    function play() {
        var text = $('#input-text').val()
        if (tts.speaking) {
            alert('Still speacking.., please wait!')
            return
        }

        tts.setLang(lang)
        tts.speak(text)
        set
    }

    if ($('.button.vietnam.lang').on('click', function () {
            changeLang('vi')
        }))

        if ($('.button.japan.lang').on('click', function () {
                changeLang('ja')
            }))

            if ($('.button.en.lang').on('click', function () {
                    changeLang('en_us')
                }))



                $('.submit.listen').on('click', function () {
                    play()
                })
}