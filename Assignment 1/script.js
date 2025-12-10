const slider = document.querySelector('.slider')

setInterval(()=> {
    const active = slider.querySelector('img.active')
    active.classList.remove('active')

    const next = active.nextElementSibling || slider.firstElementChild
    next.classList.add('active')
}, 5000)