/*
 * Copyright (C) 2019-2020  Alex Yatskov <alex@foosoft.net>
 * Author: Alex Yatskov <alex@foosoft.net>
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

/* global
 * FrontendApiSender
 */

class PopupProxy {
    constructor(id, depth, parentId, parentFrameId, url, getFrameOffset=null) {
        this._parentId = parentId;
        this._parentFrameId = parentFrameId;
        this._id = id;
        this._depth = depth;
        this._url = url;
        this._apiSender = new FrontendApiSender();
        this._getFrameOffset = getFrameOffset;

        this._frameOffset = null;
        this._frameOffsetPromise = null;
        this._frameOffsetUpdatedAt = null;
    }

    // Public properties

    get id() {
        return this._id;
    }

    get parent() {
        return null;
    }

    get depth() {
        return this._depth;
    }

    get url() {
        return this._url;
    }

    // Public functions

    async prepare() {
        const {id} = await this._invokeHostApi('getOrCreatePopup', {id: this._id, parentId: this._parentId});
        this._id = id;
    }

    isProxy() {
        return true;
    }

    broadcastRootPopupInformation() {
        // NOP
    }

    async setOptions(options) {
        return await this._invokeHostApi('setOptions', {id: this._id, options});
    }

    hide(changeFocus) {
        this._invokeHostApi('hide', {id: this._id, changeFocus});
    }

    async isVisible() {
        return await this._invokeHostApi('isVisible', {id: this._id});
    }

    setVisibleOverride(visible) {
        this._invokeHostApi('setVisibleOverride', {id: this._id, visible});
    }

    async containsPoint(x, y) {
        if (this._getFrameOffset !== null) {
            await this._updateFrameOffset();
            [x, y] = this._applyFrameOffset(x, y);
        }
        return await this._invokeHostApi('containsPoint', {id: this._id, x, y});
    }

    async showContent(elementRect, writingMode, type=null, details=null) {
        let {x, y, width, height} = elementRect;
        if (this._getFrameOffset !== null) {
            await this._updateFrameOffset();
            [x, y] = this._applyFrameOffset(x, y);
        }
        elementRect = {x, y, width, height};
        return await this._invokeHostApi('showContent', {id: this._id, elementRect, writingMode, type, details});
    }

    async setCustomCss(css) {
        return await this._invokeHostApi('setCustomCss', {id: this._id, css});
    }

    clearAutoPlayTimer() {
        this._invokeHostApi('clearAutoPlayTimer', {id: this._id});
    }

    async setContentScale(scale) {
        this._invokeHostApi('setContentScale', {id: this._id, scale});
    }

    // Private

    _invokeHostApi(action, params={}) {
        if (typeof this._parentFrameId !== 'number') {
            return Promise.reject(new Error('Invalid frame'));
        }
        return this._apiSender.invoke(action, params, `popup-proxy-host#${this._parentFrameId}`);
    }

    async _updateFrameOffset() {
        const firstRun = this._frameOffsetUpdatedAt === null;
        const expired = firstRun || this._frameOffsetUpdatedAt < Date.now() - 1000;
        if (this._frameOffsetPromise === null && !expired) { return; }

        if (this._frameOffsetPromise !== null) {
            await this._frameOffsetPromise;
            return;
        }

        if (firstRun) {
            this._frameOffsetPromise = this._getFrameOffset();
            this._frameOffset = await this._frameOffsetPromise;
            this._frameOffsetPromise = null;
            this._frameOffsetUpdatedAt = Date.now();
        } else {
            this._getFrameOffset().then((offset) => {
                this._frameOffset = offset;
                this._frameOffsetUpdatedAt = Date.now();
            });
        }
    }

    _applyFrameOffset(x, y) {
        const [offsetX, offsetY] = this._frameOffset;
        return [x + offsetX, y + offsetY];
    }
}
