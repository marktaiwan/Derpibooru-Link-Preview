// ==UserScript==
// @name         Derpibooru Comment Preview
// @description  Hover preview for links to other comments
// @version      1.0.18
// @author       Marker
// @namespace    https://github.com/marktaiwan/
// @homepageURL  https://github.com/marktaiwan/Derpibooru-Quote-Preview
// @supportURL   https://github.com/marktaiwan/Derpibooru-Quote-Preview/issues
// @include      /^https?://(www\.)?(derpiboo\.ru|derpibooru\.org|trixiebooru\.org)/\d{1,}(\??.{1,}|/|\.html)?/
// @include      /^https?://(www\.)?(derpiboo\.ru|derpibooru\.org|trixiebooru\.org)/lists/user_comments/\d{1,}(\??.{1,}|/|\.html)?/
// @include      /^https?://(www\.)?(derpiboo\.ru|derpibooru\.org|trixiebooru\.org)/lists/my_comments(\??.{1,}|/|\.html)?$/
// @grant        none
// ==/UserScript==

(function() {
    'use strict';
    function displayHover(comment, link) {
        const PADDING = 5; // px

        if (!hover) return;

        // hack for preventing mulltiple previews from appearing due to fetch()
        var preview = document.querySelectorAll('#hover_preview');
        if (preview !== null) {
            for (i = 0; i < preview.length; i++) {
                preview[i].parentNode.removeChild(preview[i]);
            }
        }

        comment = comment.cloneNode(true);
        comment.id = 'hover_preview';
        comment.style.position = 'absolute';
        comment.style.maxWidth = '980px';
        comment.style.minWidth = '490px';

        // Make spoiler visible
        var i;
        var list = comment.querySelectorAll('span.spoiler, span.imgspoiler, span.imgspoiler img');
        if (list !== null) {
            for (i = 0; i < list.length; i++) {

                if (list[i].matches('span')) {
                    list[i].style.color = '#333';
                    list[i].style.backgroundColor = '#f7d4d4';
                } else {
                    list[i].style.visibility = 'visible';
                }

            }
        }

        var container = document.getElementById('image_comments') || document.getElementById('content');
        if (container) container.appendChild(comment);

        // calculate link position
        var linkRect = link.getBoundingClientRect();
        var linkTop = linkRect.top + viewportPos().top;
        var linkLeft = linkRect.left + viewportPos().left;

        var commentRect = comment.getBoundingClientRect();
        var commentTop;
        var commentLeft;

        // When there is room, place the preview above the link
        // otherwise place it to the right and aligns it to the top of viewport
        if (linkRect.top > commentRect.height + PADDING) {

            commentTop = linkTop - commentRect.height - PADDING;
            commentLeft = linkLeft;

        } else {

            commentTop = viewportPos().top + PADDING;
            commentLeft = linkLeft + linkRect.width + PADDING;

        }

        comment.style.top = commentTop + 'px';
        comment.style.left = commentLeft + 'px';
    }

    function linkEnter(e) {

        // filtering
        if (!e.target.matches('.communication__body__text a[href*="#comment_"], .communication__body__text a[href*="#comment_"]>*')) return;

        hover = true;

        // Example: e.target.hash == "#comment_5430424"
        var sourceLink = e.target.parentNode.matches('a[href*="#comment_"]') ? e.target.parentNode : e.target;
        var targetID = sourceLink.hash.slice(9);
        var targetComment = document.getElementById('comment_' + targetID);

        // ignore quotes
        // this is terrible
        if (sourceLink.nextElementSibling &&
            sourceLink.nextElementSibling.nextElementSibling &&
            sourceLink.nextElementSibling.nextElementSibling.matches('blockquote')) return;


        if (targetComment !== null) {

            // Post exist on current page
            if (!elementInViewport(targetComment)) displayHover(targetComment, sourceLink);

            // Highlight linked post
            targetComment.firstChild.style.backgroundColor = 'rgba(230,230,30,0.3)';

        } else {
            // External post, display from cached response if possible
            if (fetchCache[targetID] !== undefined) {

                displayHover(fetchCache[targetID], sourceLink);

            } else {

                fetch(window.location.origin + '/comment/' + targetID + '.html')
                    .then((response) => response.text())
                    .then((text) => {
                        var d = document.createElement('div');
                        d.innerHTML = text;
                        fetchCache[targetID] = d.firstChild;
                        displayHover(d.firstChild, sourceLink);
                });

            }

        }
    }

    function linkLeave(e) {

        // filtering
        if (!e.target.matches('.communication__body__text a[href*="#comment_"], .communication__body__text a[href*="#comment_"]>*')) return;

        hover = false;

        var i;
        var sourceLink = e.target.parentNode.matches('a[href*="#comment_"]') ? e.target.parentNode : e.target;
        var targetID = sourceLink.hash.slice(9);
        var targetComment = document.getElementById('comment_' + targetID);
        var preview = document.getElementById('hover_preview');

        // ignore quotes
        // this is still terrible
        if (sourceLink.nextElementSibling &&
            sourceLink.nextElementSibling.nextElementSibling &&
            sourceLink.nextElementSibling.nextElementSibling.matches('blockquote')) return;

        //remove highlight
        if (targetComment !== null) targetComment.firstChild.style.backgroundColor = '';

        if (preview !== null) preview.parentNode.removeChild(preview);

    }

    // Chrome/Firefox compatibility hack for getting viewport position 
    function viewportPos() {
        return {
            top: (document.documentElement.scrollTop || document.body.scrollTop),
            left: (document.documentElement.scrollLeft || document.body.scrollLeft)
        };
    }

    function elementInViewport(el) {
        var rect = el.getBoundingClientRect();

        return (
            rect.top >= 0 &&
            rect.left >= 0 &&
            rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
            rect.right <= (window.innerWidth || document.documentElement.clientWidth)
        );
    }

    var hover = false;
    var fetchCache = {};
    var container = document.getElementById('image_comments') || document.getElementById('content');

    if (container) {
        container.addEventListener('mouseover', linkEnter);
        container.addEventListener('mouseout', linkLeave);
    }
})();
